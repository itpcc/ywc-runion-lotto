# ywc-reunion-lotto

## Server part

To install dependencies:

```bash
cd ./
bun install
```

To run:

```bash
bun run index.js
```

Noted that, for testing; if you want to test, replace line #7 in `index.js` from:

```js
const db = new Database("lotto.sqlite");
```

```js
const db = new Database(":memory:");
```

Also, for `ticket` mode, please edit `namelist.csv` data before start the server. The program will automatically load the file on startup.

### Websocket

To connect the server use:

```js
ws://${host}:${port}/ws?token=${encodeURI(token)}
```

where `token` is token specify in `tokenLookup`.

#### Commands

The command is in JSON format as following:

```js
{
    "command":"<command>",
    ...playload
}
```

By default, each command will response with JSON-formatted message as following:

```js
{
    "command":"<command>",
    "ok": <true|false>,
    ...response
}
```

Here's the format of `SQL row record`:

```json
{
    "serialno":47,
    "add_at":"ISO 8601 Date and time in UTC (YYYY-MM-DD\THH:MM:SS.mm\Z)"
}
```

| Command     | Role                   | Payload                                                 | Description                                 | Response                                                        |
|-------------|------------------------|---------------------------------------------------------|---------------------------------------------|-----------------------------------------------------------------|
| mode        | admin                  | `"mode": "<lotto|ticket>"`                              | Change random mode between lotto and ticket | (DEFAULT)                                                       |
| lock        | admin                  | Mode `lotto`: `"serialno": <number from 1 - 99>`        | Lock the serial number in the next roll     | (DEFAULT)                                                       |
|             |                        | Mode `ticket`: `"serialno": <Ticket number (ticketno)>` |                                             |                                                                 |
| unlock      | admin                  | (NULL)                                                  | Unlock the serial number                    | (DEFAULT)                                                       |
| get_lock    | admin                  | (NULL)                                                  | Unlock the serial number                    | `"data":<SQL config record | NULL>}`                            |
| last_serial | admin/roller/projector | (NULL)                                                  | See the last number that roll               | `"serialno":<number | NULL>}, "data":<SQL row record | NULL>`\* |
| list        | admin                  | (NULL)                                                  | List history of rolling numbers             | `"data":<SQL row record[] | NULL>`\*                            |
| roll        | roller                 | (NULL)                                                  | Well, roll the ~~dice~~ number              | (DEFAULT)\*                                                     |

Note:
\*  If the mode is `ticket`, these fields will also included in the response (or in each row of SQL row record):

```json
{
    "name": "<ticket owner name>",
    "ywc_gen": <YWC genenration number>
}
```

#### Messages

| Message     | Description                 | Payload                                                              |
|-------------|-----------------------------|----------------------------------------------------------------------|
| Connect     | Message send once connected | `{"command":"connect","ok":true,"role":"<admin/roller/projector>"}`  |
| Mode Change | New Mode is applied         | `{"command":"mode_change","mode":"<lotto|ticket>", "serialno":99}`\* |
| Roll        | The wait IS OVER            | `{"command":"roll","type":"<random/lock/notrandom>","serialno":99}`  |

Note:
\*  If the mode is `ticket`, these fields will also included in the response:

```json
{
    "name": "<ticket owner name>",
    "ywc_gen": <YWC genenration number>
}
```

### Bun notes

This project was created using `bun init` in bun v0.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Web part

Well, because I'm "lazy", I use SveltKit.

The project is in [`./web`](./web/) folder.

To init,

```bash
cd ./web
pnpm install
pnpm run dev -- --open
```

To build,

```bash
cd ./web
pnpm run build
```

## [Figma](figma.com/file/ijLAnNx7s5VQVTUmTukK2F/Reunion-11?node-id=186%3A99)

## License

UNLICENSED (For now)

Thai font is [RD CHULAJARUEK Regular](https://www.f0nt.com/release/rd-chulajaruek-regular/).
