import { Database } from "bun:sqlite";
import Bao from "baojs";
import serveStatic from "serve-static-bun";

console.log("YWC Reunion#11(2) Lotto server: Begin");

const db = new Database("lotto.sqlite"); // const db = new Database(":memory:");
console.log("DB: Init");
db.run(`CREATE TABLE IF NOT EXISTS lotto (
	serialno	NUMERIC,
	add_at		DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
);`);
db.run(`CREATE TABLE IF NOT EXISTS config (
	key		TEXT PRIMARY KEY,
	value	TEXT
);`);


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
			role
		}), false);
	},
	message: (ws, msg) => {
		try {
			const payload = JSON.parse(msg);
			// Only for authorized users
			const role = ws.data.ctx.extra.role;
			console.log(`WS: "${role}" Send message: ${msg}`, typeof msg);

			if (
				payload?.command === 'lock' && role === 'admin' &&
				Number.isInteger(payload?.serialno)
			) {
				const res = db.query(`
					INSERT INTO config (key, value)
					VALUES('serial_lock', ?)
					ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
					RETURNING *;
				`).get(`${payload.serialno}`);

				if (res) {
					ws.send(JSON.stringify({
						command: 'lock',
						ok: true
					}), false);
					return;
				}
			} else if (payload?.command === 'unlock' && role === 'admin') {
				db.run(`DELETE FROM config WHERE key = 'serial_lock';`);
				ws.send(JSON.stringify({
					command: 'unlock',
					ok: true
				}), false);
				return;
			} else if (payload?.command === 'get_lock' && role === 'admin') {
				const data = db.query(`SELECT * FROM config WHERE key = 'serial_lock' LIMIT 1;`).get();
				ws.send(JSON.stringify({
					command: 'get_lock',
					ok: true,
					data
				}), false);
				return;
			} else if (payload?.command === 'last_serial') {
				const data = db.query(`SELECT * FROM lotto ORDER BY add_at DESC LIMIT 1;`).get();
				ws.send(JSON.stringify({
					command: 'last_serial',
					ok: true,
					serialno: data?.serialno,
					data
				}), false);
				return;
			} else if (payload?.command === 'list' && role === 'admin') {
				const data = db.query(`SELECT * FROM lotto ORDER BY add_at DESC;`).all();
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

				const lockSerial = db.query(
					`SELECT * FROM config WHERE key = 'serial_lock' LIMIT 1;`
				).get();

				if (lockSerial) {
					ws.publish('lotto', JSON.stringify({
						command: 'roll',
						type: 'lock',
						serialno: Number(lockSerial.value)
					}));
					db.run(`
						INSERT INTO lotto (serialno)
						VALUES (${lockSerial.value})
						ON CONFLICT DO NOTHING
						RETURNING *;
					`);
					return;
				}

				const randomSerial = db.query(`
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
				`).get();

				if (randomSerial) {
					ws.publish('lotto', JSON.stringify({
						command: 'roll',
						type: 'random',
						serialno: Number(randomSerial.serialno)
					}));
					return;
				}

				// When the number is exhaused, f**k it.
				// The random is no more. It has ceased to be. This is an ex-random.
				const notRandom = db.query(`
				INSERT INTO lotto (serialno)
				VALUES (?)
				ON CONFLICT DO NOTHING
				RETURNING *;
				`).get(Number(Math.random() * (99 - 1) + 1).toFixed(00));
				ws.publish('lotto', JSON.stringify({
					command: 'roll',
					type: 'notrandom',
					serialno: Number(notRandom.serialno)
				}), false);
				return;
			}

			ws.send(JSON.stringify({
				command: 'unknown',
				ok: false
			}), false);
		} catch (e) {
			console.error("WS: Message error: ", e);
			ws.send(JSON.stringify({ error: e.message }), false);
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
