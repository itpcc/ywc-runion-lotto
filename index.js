import { Database } from "bun:sqlite";
import Bao from "baojs";
import serveStatic from "serve-static-bun";
import { parse } from 'csv-parse/sync';

console.log("YWC Reunion#11(2) Lotto server: Begin");

const db = new Database(":memory:"); // const db = new Database("lotto.sqlite"); 
console.log("DB: Init");
db.run(`CREATE TABLE IF NOT EXISTS lotto (
	serialno	NUMERIC,
	add_at		DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
);`);
db.run(`CREATE TABLE IF NOT EXISTS tickets (
	ticketno	TEXT PRIMARY KEY,
	ywc_gen		TEXT,
	name		TEXT
);`);
db.run(`CREATE TABLE IF NOT EXISTS ticket_randoms (
	ticketno	TEXT,
	add_at		DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
);`);
db.run(`CREATE TABLE IF NOT EXISTS config (
	key		TEXT PRIMARY KEY,
	value	TEXT
);`);

// Import EventPop database (if any)
// Tried to read it. If success, import
// @see https://github.com/jakobbouchard/serve-static-bun/blob/main/src/utils/get-file-info.ts#L27
const importNamelist = async () => {
	const namelistFile = Bun.file('./namelist.csv');
	const recordFileInfo = await namelistFile.text();
	const records = parse(recordFileInfo, { delimiter: ',' });

	if (records.length < 2) {
		console.log('CSV: No data to import', e);
		return;
	}

	const colIdxLku = Object.fromEntries(
		[ 'ticket_id', 'name', 'ywc_gen' ].map(key => [ key, records[0].indexOf(key) ])
	);

	if (! Object.values(colIdxLku).every(idx => idx !== -1)) {
		console.log('CSV: Invalid format', e);
		return;
	}

	const insertStm = db.prepare(
		'INSERT INTO tickets (ticketno, ywc_gen, name) VALUES (?, ?, ?);'
	);
	const insertManyProc = db.transaction((rows) => {
		db.run('DELETE FROM tickets;');
		for (const row of rows) if (row && row.length >= 3) insertStm.run(
			row[colIdxLku.ticket_id],
			row[colIdxLku.ywc_gen],
			row[colIdxLku.name],
		);
	});

	insertManyProc(records.slice(1));
	console.log('CSV: Namelist imported', db.query('SELECT * FROM tickets;').all());
};
const randomMode = () => {
	return db.query(`SELECT value FROM config WHERE key = 'random_mode' LIMIT 1;`)
		.get()?.value ?? 'lotto';
};
const lockKey = () => (randomMode() === 'lotto') ? 'serial_lock' : 'ticket_lock';
const getLastSerial = (randomModeStr) => db.query(
	(randomModeStr === 'lotto') ?
		`SELECT * FROM lotto ORDER BY add_at DESC LIMIT 1;` :
		`
			SELECT tr.*, ticketno AS serialno, t.name, t.ywc_gen
			FROM ticket_randoms tr
				LEFT JOIN tickets t USING (ticketno)
			ORDER BY add_at DESC LIMIT 1;
		`
).get();
const additionalInfo = (randomModeStr, serialno) => {
	return (randomModeStr === 'lotto') ? {} : (db.query(
		'SELECT ywc_gen, name FROM tickets WHERE ticketno = ? LIMIT 1;'
	).get(serialno) ?? {});
};

console.log("Web: Init");

const app = new Bao();

// Websocket
// Ping/pong
app.ws("/ping", {
	message: (ws, msg) => {
		ws.send("pong");
	},
});

app.ws("/ws", {
	upgrade: (ctx) => {
		const tokenLookup = {
			admin: 'admin1234',
			roller: 'roller1234',
			projector: 'projector',
		};
		const token = ctx.query.get("token");

		if (! token) {
			// forceSend() is required here to deny the upgrade
			return ctx.sendText("Unauthorized", { status: 401 }).forceSend();
		}

		const role = Object.keys(tokenLookup).find(key => tokenLookup[key] === token);

		if (! role) {
			// forceSend() is required here to deny the upgrade
			return ctx.sendText("Forbidden", { status: 403 }).forceSend();
		}

		// User is now authenticated
		ctx.extra.role = role;

		return ctx;
	},
	open: (ws) => {
		// Only for authorized users
		const role = ws.data.ctx.extra.role;

		console.log(`WS: User "${role}" connected with the secret token`);
		ws.subscribe('lotto');
		ws.send(JSON.stringify({
			command: 'connect',
			ok: true,
			mode: randomMode(),
			role
		}), false);
	},
	message: (ws, msg) => {
		try {
			const payload = JSON.parse(msg);
			// Only for authorized users
			const role = ws.data.ctx.extra.role;
			console.log(`WS: "${role}" Send message: ${msg}`);

			if (
				payload?.command === 'mode' && role === 'admin' &&
				(payload?.mode === 'lotto' || payload?.mode === 'ticket')
			) {
				const res = db.query(`
					INSERT INTO config (key, value)
					VALUES ('random_mode', ?)
					ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
					RETURNING *;
				`).get(payload.mode);

				ws.send(JSON.stringify({
					command: 'mode',
					ok: !!res
				}), false);

				const lastSerialData = getLastSerial(res?.value) ?? {};
				ws.publish('lotto', JSON.stringify({
					command: 'mode_change',
					mode: res.value,
					...lastSerialData
				}), false);
				return;
			} else if (
				payload?.command === 'lock' && role === 'admin' &&
				Number.isInteger(payload?.serialno)
			) {
				const res = db.query(`
					INSERT INTO config (key, value)
					SELECT $key AS key, $serial AS value
					WHERE $key = 'serial_lock' OR EXISTS (
						SELECT 1 FROM tickets
						WHERE ticketno = $serial
					)
					ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
					RETURNING *;
				`).get({
					$key: lockKey(),
					$serial: `${payload.serialno}`
				});

				ws.send(JSON.stringify({
					command: 'lock',
					ok: !!res
				}), false);
				return;
			} else if (payload?.command === 'unlock' && role === 'admin') {
				db.run(`DELETE FROM config WHERE key = '${lockKey()}';`);
				ws.send(JSON.stringify({
					command: 'unlock',
					ok: true
				}), false);
				return;
			} else if (payload?.command === 'get_lock' && role === 'admin') {
				const data = db.query(
					`SELECT * FROM config WHERE key = '${lockKey()}' LIMIT 1;`
				).get();
				ws.send(JSON.stringify({
					command: 'get_lock',
					ok: true,
					data
				}), false);
				return;
			} else if (payload?.command === 'last_serial') {
				const randomModeStr = randomMode();
				const data = getLastSerial(randomModeStr);
				ws.send(JSON.stringify({
					command: 'last_serial',
					ok: true,
					serialno: data?.serialno,
					data,
					...additionalInfo(randomModeStr, data?.serialno)
				}), false);
				return;
			} else if (payload?.command === 'list' && role === 'admin') {
				const data = db.query(
					(randomMode() === 'lotto') ? `
					SELECT * FROM lotto ORDER BY add_at DESC;
					` : `
					SELECT tr.*, ticketno AS serialno, t.name, t.ywc_gen
					FROM ticket_randoms tr
						LEFT JOIN tickets t USING (ticketno)
					ORDER BY add_at DESC;
					`
				).all();
				ws.send(JSON.stringify({
					command: 'unlock',
					ok: true,
					data
				}), false);
				return;
			} else if (payload?.command === 'roll' && role === 'roller') {
				// ACK
				ws.send(JSON.stringify({
					command: 'roll',
					ok: true
				}), false);

				const randomModeStr = randomMode();

				const lockSerial = db.query(
					`SELECT * FROM config WHERE key = '${lockKey()}' LIMIT 1;`
				).get();

				if (lockSerial) {
					ws.publish('lotto', JSON.stringify({
						command: 'roll',
						type: 'lock',
						serialno: Number(lockSerial.value),
						...additionalInfo(randomModeStr, lockSerial.value)
					}));
					db.run(`
						INSERT INTO ${(randomModeStr === 'lotto') ? 'lotto (serialno)' : 'ticket_randoms (ticketno)'}
						VALUES (${lockSerial.value})
						ON CONFLICT DO NOTHING
						RETURNING *;
					`);
					return;
				}

				const randomSerial = db.query(
					(randomModeStr === 'lotto') ? `
						WITH RECURSIVE all_no(serialno) AS (
							SELECT 1
							UNION ALL
							SELECT serialno + 1 FROM all_no LIMIT 99
						), virgin_no AS (
							SELECT serialno FROM all_no
							WHERE NOT EXISTS (
								SELECT 1 FROM lotto
								WHERE lotto.serialno = all_no.serialno
							)
							ORDER BY RANDOM()
							LIMIT 1
						)

						INSERT INTO lotto (serialno)
						SELECT serialno FROM virgin_no ORDER BY RANDOM() LIMIT 1
						ON CONFLICT DO NOTHING
						RETURNING *;
					` : `
					INSERT INTO ticket_randoms (ticketno)
					SELECT ticketno FROM tickets t
					WHERE NOT EXISTS (
						SELECT 1 FROM ticket_randoms tr
						WHERE tr.ticketno = t.ticketno
					)
					ORDER BY RANDOM() LIMIT 1
					ON CONFLICT DO NOTHING
					RETURNING *, ticketno AS serialno;
					`
				).get();

				if (randomSerial) {
					ws.publish('lotto', JSON.stringify({
						command: 'roll',
						type: 'random',
						serialno: Number(randomSerial.serialno),
						...additionalInfo(randomModeStr, randomSerial.serialno)
					}));
					return;
				}

				// When the number is exhaused, f**k it.
				// The random is no more. It has ceased to be. This is an ex-random.
				const notRandom = db.query(
					(randomModeStr === 'lotto') ? `
						INSERT INTO lotto (serialno)
						VALUES (${Number(Math.random() * (99 - 1) + 1).toFixed(0)})
						ON CONFLICT DO NOTHING
						RETURNING *;
					` : `
						INSERT INTO ticket_randoms (ticketno)
						SELECT ticketno FROM tickets t
						ORDER BY RANDOM() LIMIT 1
						ON CONFLICT DO NOTHING
						RETURNING *, ticketno AS serialno;
					`
				).get();
				ws.publish('lotto', JSON.stringify({
					command: 'roll',
					type: 'notrandom',
					serialno: Number(notRandom.serialno),
					...additionalInfo(randomModeStr, notRandom.serialno)
				}), false);
				return;
			}

			ws.send(JSON.stringify({
				command: 'unknown',
				ok: false
			}), false);
		} catch (e) {
			console.error("WS: Message error: ", e);
			ws.send(JSON.stringify({ ok: false, error: e.message }), false);
		}
	}
});

// Web
const rootCtrl = serveStatic("web/build", { middlewareMode: "bao" });
app.get("/", rootCtrl);
app.get("/assets/*any", serveStatic("web/build/assets", { middlewareMode: "bao", stripFromPathname: "/assets" }));
app.get("/_app/*any", serveStatic("web/build/_app", { middlewareMode: "bao", stripFromPathname: "/_app" }));

const server = app.listen({ port: process.env.PORT ?? 3000 });

console.log(`Web: Listening on ${server.hostname}:${server.port}`);
importNamelist();
