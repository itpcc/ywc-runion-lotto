<script>
	import { dev } from '$app/environment';
	import { onDestroy } from 'svelte';
	import 'chota';
	// @ts-ignore
	import { Input, Button, Container, Field, Card, Row } from 'svelte-chota';
	import toast, { Toaster } from 'svelte-french-toast';
	// @ts-ignore
	import MarqueeTextWidget from "svelte-marquee-text-widget";

	const ROLL_DURATION_MS = 5000;

	let isConnectWS = false;
	let isRoller = false;
	let token = '';
	let randomMode = '';
	let serialNo = '00';
	let ticketName = '';
	let ticketNameMarqueePause = true;
	let ticketNameFontSize = '10rem';
	let ticketYwcGen = '';
	let ticketYwcGenDisplay = 'block';

	// Admin variable
	let isAdmin = false;
	let isLock = false;
	let adminLockSerial = '';
	let adminLockTicket = '';
	/**
	 * @type {{
	 *     serialno: string,
	 *     name: string,
	 *     ywc_gen: string
	 * }[]}
	 */
	let ticketList = [];
	/**
	 * @type {WebSocket}
	 */
	let socket;

	/**
	 * @type {number}
	 */
	let rollNumberStartAt = 0;
	let actualSerialNo = '';

	/**
	 * @param {number} ts
	 */
	function rollNumer (ts) {
		if (! rollNumberStartAt) {
			rollNumberStartAt = ts;
		}

		if (ts - rollNumberStartAt > ROLL_DURATION_MS) {
			rollNumberStartAt = 0;

			serialNo = actualSerialNo;

			return;
		}

		serialNo = (Math.random() * 100).toFixed().padStart(2, '0');

		window.requestAnimationFrame(rollNumer);
	};

	/**
	 * @param {{ serialno: ?string; name: ?string; ywc_gen: ?string; }} payload
	 */
	function updateSerial (payload, isRoll = false) {
		const displaySerialNo = payload?.serialno
			? (
				(randomMode === 'lotto') ?
					Number(payload?.serialno).toString().padStart(2, '0') :
					payload?.serialno
			) :
			'--';
		if (isRoll) {
			actualSerialNo = displaySerialNo;
			window.requestAnimationFrame(rollNumer);
		} else {
			serialNo = displaySerialNo;
		}

		ticketName = payload?.name ?? '________';
		ticketYwcGen = payload?.ywc_gen ? `YWC#${payload.ywc_gen.padStart(2, '0')}` : '';

		const ticketNameNonFloat = ticketName.replace(/[\u0E31\u0E34-\u0E3E\u0E47-\u0E4E]/g, '');
		ticketNameFontSize = `${10 + (13 / Math.max(1, (ticketNameNonFloat.length - 4) * 2))}rem`;
		ticketNameMarqueePause = ticketNameNonFloat.length <= 9;
		ticketYwcGenDisplay = ((payload?.ywc_gen?.length ?? 0) > 0) ? 'block' : 'none';
	};

	function connectWS() {
		if (!token) {
			toast.error('No token provided');
		}

		const url = `ws://${dev ? 'arch.wsl:3000' : location.host}/ws?token=${encodeURI(token)}`;
		socket = new WebSocket(url);

		socket.addEventListener('open', (event) => {
			serialNo = '--';
			socket.send('{ "command":"last_serial" }');
		});
		socket.addEventListener('message', (event) => {
			console.log('Message from server ', event.data);
			try {
				const payload = JSON.parse(event.data);

				if (payload?.command === 'connect' && payload?.role) {
					isConnectWS = true;
					randomMode = payload.mode;
					isRoller = (payload.role === 'roller');
					isAdmin = (payload.role === 'admin');

					if (isAdmin) {
						socket.send('{ "command":"get_lock" }');

						if (randomMode === 'ticket') {
							socket.send('{ "command":"tickets" }');
						}
					}
				} else if (payload?.command === 'mode_change' && payload?.mode) {
					randomMode = payload.mode;
					updateSerial(payload);
				} else if (payload?.command === 'last_serial' && payload?.serialno) {
					updateSerial(payload);

					if (isAdmin) toast.success(`Load last serial: ${payload?.serialno}`);
				} else if (payload?.command === 'roll' && payload?.serialno) {
					updateSerial(payload, true);

					if (isAdmin) toast.success(`Roll: ${payload?.serialno}`);
				} else if (payload?.command === 'get_lock' && payload?.ok) {
					isLock = payload?.data === null;

					if (! isLock) {
						if (randomMode === 'lotto') adminLockSerial = payload.data?.value;
						else adminLockTicket = payload.data?.value;
					}
				} else if (payload?.command === 'lock' && payload?.ok) {
					isLock = true;

					if (isAdmin) toast.success(`Lock!`);
				} else if (payload?.command === 'unlock' && payload?.ok) {
					isLock = false;

					if (isAdmin) toast.success(`Unlock!`);
				} else if (payload?.command === 'tickets' && payload?.ok) {
					ticketList = payload?.data ?? [];
				}
			} catch (err) {
				console.error('JSON Error: ', err);
			}
		});
		socket.addEventListener('error', (event) => {
			console.log('WebSocket error: ', event);
			toast.error('Connection error');
			socket.close();
		});
		socket.addEventListener('close', (event) => {
			isRoller = false;

			if (isConnectWS) {
				toast.error('Connection lost. Reconnect will be attempted in 1 second.');

				console.log('Socket is closed. Reconnect will be attempted in 1 second.', event?.reason);

				setTimeout(function () { connectWS(); }, 1000);
			}
		});
	}

	/**
	 * @param {string | ArrayBufferLike | Blob | ArrayBufferView} cmdStr
	 */
	function sendCommand (cmdStr) {
		if (!socket) {
			toast.error('No socket provided');
			return;
		}

		socket.send(cmdStr);
	}

	function rollLotto() {
		sendCommand('{ "command":"roll" }');
	}

	function adminCommandLock() {
		sendCommand(JSON.stringify({
			command: 'lock',
			serialno: Number((randomMode === 'lotto') ? adminLockSerial : adminLockTicket)
		}));
	}

	function adminCommandUnlock() {
		sendCommand('{ "command":"unlock" }');
	}

	onDestroy(() => {
		if (socket) socket.close();
		isConnectWS = false;
	});
</script>

<Container class="is-center page-container">
	{#if !isConnectWS}
		<Card>
			<form on:submit|preventDefault={connectWS}>
				<Field grouped>
					<Input outline label="Token:" id="token" bind:value={token} />
					<Button submit>Connect</Button>
				</Field>
			</form>
		</Card>
	{:else}
		<Container class="roll-container roll-mode-{randomMode}">
			{#if randomMode === 'ticket'}
				<Container class="lotto-ticket-container">
					<Row class="is-center lotto-ticket-row">
						{#if ticketNameMarqueePause}
							<h1
								class="lotto-name"
								data-info={ticketName}
								style:--font-size={ticketNameFontSize}
							>{ticketName}</h1>
						{:else}
							<MarqueeTextWidget>
								<h1
									class="lotto-name with-marquee"
									data-info={ticketName}
									style:--font-size={ticketNameFontSize}
								>{ticketName}</h1>
							</MarqueeTextWidget>
						{/if}
					</Row>
					<Row class="is-center">
						<h2 class="lotto-ywc-gen" style:--font-size={ticketYwcGenDisplay}>{ticketYwcGen}</h2>
					</Row>
				</Container>
			{:else}
				<Row class="is-center lotto-number-row">
					<h1 class="lotto-number" data-info={serialNo}>{serialNo}</h1>
				</Row>
			{/if}
			{#if isRoller}
				<Row class="is-center roll-row">
					<Button class="lotto-roll" on:click={rollLotto}>Random Here!</Button>
				</Row>
			{/if}
		</Container>
		<Card class="roll-admin pull-right {isAdmin ? '' : 'is-hidden'}">
			<Field gapless class="{(! isLock && randomMode === 'lotto') ? '' : 'is-hidden'}">
				<Input number min="1" max="99" placeholder="99" bind:value={adminLockSerial}/>
				<Button error on:click={adminCommandLock}>🔐 Lock</Button>
			</Field>
			<Field gapless class="{(! isLock && randomMode === 'ticket') ? '' : 'is-hidden'}">
				<select bind:value={adminLockTicket}>
					<option disabled selected>Choose</option>
					{#each ticketList as ticketInfo}
						<option value="{ticketInfo.serialno}">{ticketInfo.name} (YWC#{ticketInfo.ywc_gen})</option>
					{/each}
				</select>
				<Button error on:click={adminCommandLock}>🔐 Lock</Button>
			</Field>
			<Button success class="{isLock ? '' : 'is-hidden'}" on:click={adminCommandUnlock}>Unlock</Button>
		</Card>
	{/if}
</Container>
<Toaster />

<style global lang="scss">
	@function stroke($stroke, $color) {
		$shadow: ();
		$from: $stroke * -1;
		@for $i from $from through $stroke {
			@for $j from $from through $stroke {
				@if $i % 4 == 0 and $j % 4 == 0 {
					$shadow: append($shadow, $i * 1px $j * 1px 0 $color, comma);
				}
			}
		}
		@return $shadow;
	}

	@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

	/**
	 * Adjust Thai font to "match" with MyMint's Press Start 2P
	 * @see https://web.dev/css-size-adjust/
	 */
	@font-face {
		font-family: 'RD CHULAJARUEK';
		src: url('/assets/RD CHULAJARUEK.ttf');
		unicode-range: U+0E01-0E5B;
		// size-adjust: 170%;
		size-adjust: 150%;
		font-stretch: ultra-condensed;
		descent-override: -50%;
	}

	body {
		width: 100vw;
		height: 100vh;
		background-image: url('/assets/bg-default.svg'), url('/assets/bg-color.svg');
		// background-image: url('/assets/Random screen.png'), url('/assets/bg-color.svg');
		background-attachment: fixed, fixed;
		background-position: center, left;
		background-size: contain, 100%;
		background-repeat: no-repeat, repeat;
	}
	.page-container {
		width: 100vw;
		height: 100vh;
	}
	.roll-container {
		height: 80%;
	}
	.lotto-ticket-container {
		display: flex;
    	justify-content: center;
		position: relative;
		height: 50vh;
		margin-top: 14rem;
		height: 385px;
		height: calc(56vh - 14rem);
		overflow-x: clip;
	}
	.lotto-ticket-row {
		margin-left: 4.5rem;
    	margin-right: 7rem;
		overflow-x: clip;
	}
	.lotto-name, .lotto-name:before, .lotto-name:after {
		/* 99 */
		font-family: 'Press Start 2P', 'RD CHULAJARUEK';
		font-style: normal;
		font-weight: 200;
		font-size: 22rem;
		font-size: var(--font-size);
		text-align: center;
		color: blue;
		white-space: nowrap; // We'll deal with Marquee
		line-height: 2.35;
	}
	.lotto-name {
		position: relative;
		z-index: 0;
		/* 99 */
		color: blue;
		padding-top: 0;
		margin: 0 6rem;
	}
	.lotto-name.with-marquee {
		margin: 0 6rem;
	}
	.lotto-name:before, .lotto-name:after {
		position: absolute;
		left: 0;
		top: 0;
		content: attr(data-info);
	}
	.lotto-name:before {
		z-index: 1;
		background: linear-gradient(180deg, #00d387 0%, #004129 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-fill-color: transparent;
	}
	.lotto-name:after {
		z-index: -2;
		/*
			Do not use text-stoke: it will add "border" inside the text itself
			Wanna see how horrible it is? try doing that in MSWord!
		*/
		text-shadow: stroke(20, #FFFFFF), 0px 30px 21px #000000;
		color: red;
	}
	.lotto-ywc-gen {
		display: block;
		display: var(--display);
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 0;
		/* 99 */
		font-family: 'Press Start 2P';
		font-style: normal;
		font-weight: 400;
		font-size: 4rem;
		color: black;
		text-shadow: stroke(4, #FFFFFF), 0px 3px 2px #000000;
		padding: 0;
		margin: -1rem 0;
	}

	.lotto-number-row {
		margin-top: 17rem;
		margin-bottom: 3.85rem;
	}
	.lotto-number, .lotto-number:before, .lotto-number:after {
		/* 99 */
		font-family: 'Press Start 2P';
		font-style: normal;
		font-weight: 200;
		font-size: 20rem;
		text-align: center;
		color: blue;

		will-change: contents;
	}
	.lotto-number {
		position: relative;
		z-index: 0;
		/* 99 */
		color: blue;
		padding-top: 1.5rem;
		margin: 0;
	}
	.lotto-number:before {
		position: absolute;
		left: 0;
		z-index: 1;

		content: attr(data-info);

		background: linear-gradient(180deg, #00d387 0%, #004129 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-fill-color: transparent;
	}
	.lotto-number:after {
		position: absolute;
		left: 0;
		z-index: -2;

		content: attr(data-info);
		/*
			Do not use text-stoke: it will add "border" inside the text itself
			Wanna see how horrible it is? try doing that in MSWord!
		*/
		text-shadow: stroke(20, #FFFFFF), 0px 30px 21px #000000;
		color: red;
	}

	.roll-row {
		margin-top: 1.75rem;
	}
	.lotto-roll {
		height: 14.32rem;
		width: 43vw;
		position: relative;
		background-color: transparent;
		background-image: url('/assets/btn.png'), linear-gradient(180deg, #00FFA3 0%, #000000 100%);
		background-attachment: fixed;
		background-position: center center, top left 1rem;
		background-size: contain, calc(100% - 0.2rem) 100%;
		background-clip: border-box, content-box;
		background-repeat: no-repeat;
		padding-top: 0.5rem;

		/* Random Here! */
		font-family: 'Press Start 2P';
		font-style: normal;
		font-weight: 400;
		font-size: 5.75rem;
		line-height: 150%;
		/* or 88px */
		text-align: center;
		letter-spacing: -0.112em;

		/* Truely-White */
		color: #FFFFFF;
		text-shadow: stroke(14, #000);
	}
	.lotto-roll:after {
		content: "";
		height: 62px;
		width: 59px;
		position: absolute;
		right: 0.85rem;
		top: 0.25rem;
		background-image: url('/assets/btn-sparkle.svg');
		background-attachment: fixed;
		background-size: 100%;
		background-repeat: no-repeat;
	}

	/* Admin part */
	.roll-admin {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
	}
</style>
