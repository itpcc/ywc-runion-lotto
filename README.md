# YWC Reunion #11/12: Lotto web

## Server part

[**Bun, Bun, Bun, Bun, Bun! Lovely Bun! Wonderful Bun!**](https://youtu.be/_bW4vEo1F4E?t=86)

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

to:

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

| Command     | Role                   | Payload                                                 | Description                                 | Response                                                          |
|-------------|------------------------|---------------------------------------------------------|---------------------------------------------|-------------------------------------------------------------------|
| mode        | admin                  | `"mode": "<lotto\|ticket>"`                             | Change random mode between lotto and ticket | (DEFAULT)                                                         |
| lock        | admin                  | Mode `lotto`: `"serialno": <number from 1 - 99>`        | Lock the serial number in the next roll     | (DEFAULT)                                                         |
|             |                        | Mode `ticket`: `"serialno": <Ticket number (ticketno)>` |                                             |                                                                   |
| unlock      | admin                  | (NULL)                                                  | Unlock the serial number                    | (DEFAULT)                                                         |
| get_lock    | admin                  | (NULL)                                                  | Unlock the serial number                    | `"data":<SQL config record \| NULL>}`                             |
| tickets     | admin                  | (NULL)                                                  | List tickets loaded in the database         | `"data":<SQL ticket record \| NULL>}` \*                          |
| last_serial | admin/roller/projector | (NULL)                                                  | See the last number that roll               | `"serialno":<number \| NULL>}, "data":<SQL row record \| NULL>`\* |
| list        | admin                  | (NULL)                                                  | List history of rolling numbers             | `"data":<SQL row record[] \| NULL>`\*                             |
| roll        | roller                 | (NULL)                                                  | Well, roll the ~~dice~~ number              | (DEFAULT)\*                                                       |

Note:
\*  If the mode is `ticket`, these fields will also included in the response (or in each row of SQL row record):

```json
{
    "name": "<ticket owner name>",
    "ywc_gen": <YWC genenration number>
}
```

#### Messages

| Message     | Description                 | Payload                                                               |
|-------------|-----------------------------|-----------------------------------------------------------------------|
| Connect     | Message send once connected | `{"command":"connect","ok":true,"role":"<admin/roller/projector>"}`   |
| Mode Change | New Mode is applied         | `{"command":"mode_change","mode":"<lotto\|ticket>", "serialno":99}`\* |
| Roll        | The wait IS OVER            | `{"command":"roll","type":"<random/lock/notrandom>","serialno":99}`   |

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

![image](https://user-images.githubusercontent.com/3356814/201897015-27efd0e8-01d0-48dc-91ff-550f224af867.png)
![image](https://user-images.githubusercontent.com/3356814/201897088-d592c030-a126-468c-b7f3-a0df448e2ef5.png)
![image](https://user-images.githubusercontent.com/3356814/201897175-f13cc44b-33e6-4588-8a92-c151093b2626.png)
--------------
![image](https://user-images.githubusercontent.com/3356814/202716234-43403b48-75df-4443-ba93-cade55e6ed8a.png)
![image](https://user-images.githubusercontent.com/3356814/202716382-83e3d292-60b9-4a2a-a099-81f5aa761ce9.png)
--------------
![image](https://user-images.githubusercontent.com/3356814/204712589-bc193670-1b2c-47be-808c-859115fe3f6d.png)

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

For Non-artwork: [MIT License](./LICENSE)

Artwork: Copyright (c) 2022 Young Webmaster Camp

Thai font is [RD CHULAJARUEK Regular](https://www.f0nt.com/release/rd-chulajaruek-regular/).
