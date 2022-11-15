# ywc-reunion-lotto

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

```js
const db = new Database(":memory:");
```

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
    "ok":true,
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

| Command     | Role                   | Payload                            | Description                             | Response                                                      |
|-------------|------------------------|------------------------------------|-----------------------------------------|---------------------------------------------------------------|
| lock        | admin                  | `"serialno": <number from 1 - 99>` | Lock the serial number in the next roll | (DEFAULT)                                                     |
| unlock      | admin                  | (NULL)                             | Unlock the serial number                | (DEFAULT)                                                     |
| get_lock    | admin                  | (NULL)                             | Unlock the serial number                | `"data":<SQL config record | NULL>}`                          |
| last_serial | admin/roller/projector | (NULL)                             | See the last number that roll           | `"serialno":<number | NULL>}, "data":<SQL row record | NULL>` |
| list        | admin                  | (NULL)                             | List history of rolling numbers         | `"data":<SQL row record[] | NULL>`                            |
| roll        | roller                 | (NULL)                             | Well, roll the ~~dice~~ number          | (DEFAULT)                                                     |

#### Messages

| Message | Description                 | Payload                                                             |
|---------|-----------------------------|---------------------------------------------------------------------|
| Connect | Message send once connected | `{"command":"connect","ok":true,"role":"<admin/roller/projector>"}` |
| Roll    | The wait IS OVER            | `{"command":"roll","type":"<random/lock/notrandom>","serialno":99}` |

### Bun notes

This project was created using `bun init` in bun v0.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Web part

![image](https://user-images.githubusercontent.com/3356814/201897015-27efd0e8-01d0-48dc-91ff-550f224af867.png)
![image](https://user-images.githubusercontent.com/3356814/201897088-d592c030-a126-468c-b7f3-a0df448e2ef5.png)
![image](https://user-images.githubusercontent.com/3356814/201897175-f13cc44b-33e6-4588-8a92-c151093b2626.png)

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
