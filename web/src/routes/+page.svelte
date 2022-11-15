<script>
	import { dev } from '$app/environment';
	import { onDestroy } from 'svelte';
	import 'chota';
	import { Input, Button, Container, Field, Card, Row } from 'svelte-chota';
	import toast, { Toaster } from 'svelte-french-toast';

	let isConnectWS = false;
	let isRoller = false;
	let token = '';
	let serialNo = '00';
	/**
	 * @type {WebSocket}
	 */
	let socket;

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
			// console.log('Message from server ', event.data);

			try {
				const payload = JSON.parse(event.data);

				if (payload?.command === 'connect' && payload?.role) {
					isConnectWS = true;
					if (payload.role === 'roller') {
						isRoller = true;
					}
				} else if (payload?.command === 'last_serial' && payload?.serialno) {
					serialNo = payload?.serialno
						? Number(payload?.serialno).toString().padStart(2, '0')
						: '--';
				} else if (payload?.command === 'roll' && payload?.serialno) {
					serialNo = payload?.serialno
						? Number(payload?.serialno).toString().padStart(2, '0')
						: '--';
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
				toast.error('Connection lost. Reconnect will be attempted in 1 second');

				console.log('Socket is closed. Reconnect will be attempted in 1 second.', event.reason);
				setTimeout(function () {
					connectWS();
				}, 1000);
			}
		});
	}

	function rollLotto() {
		if (!socket) {
			toast.error('No socket provided');
			return;
		}

		socket.send('{ "command":"roll" }');
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
		<Container class="roll-container">
			<Row class="is-center">
				<h1 class="lotto-number" data-serialno={serialNo}>{serialNo}</h1>
			</Row>
			{#if isRoller}
				<Row class="is-center roll-row">
					<Button class="lotto-roll" on:click={rollLotto}>Random Here!</Button>
				</Row>
			{/if}
		</Container>
	{/if}
</Container>
<Toaster />

<style global lang="scss">
	@function stroke($stroke, $color) {
		$shadow: ();
		$from: $stroke * -1;
		@for $i from $from through $stroke {
			@for $j from $from through $stroke {
				$shadow: append($shadow, $i * 1px $j * 1px 0 $color, comma);
			}
		}
		@return $shadow;
	}

	@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

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
		// background-color: rgba(255,0,0,0.5);
	}
	.lotto-number, .lotto-number:before, .lotto-number:after {
		/* 99 */
		font-family: 'Press Start 2P';
		font-style: normal;
		font-weight: 200;
		font-size: 22rem;
		text-align: center;
		color: blue;
	}
	.lotto-number {
		position: relative;
		z-index: 0;
		/* 99 */
		color: blue;
    	padding-top: 9.5rem;
		margin-bottom: 0;
	}
	.lotto-number:before {
		position: absolute;
		left: 0;
		z-index: 1;

		content: attr(data-serialno);

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

		content: attr(data-serialno);
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
    	width: 42vw;
		position: relative;
		background-color: transparent;
		background-image: url('/assets/btn.png'), linear-gradient(180deg, #00FFA3 0%, #000000 100%);
		background-attachment: fixed;
		background-position: center center, top .2rem center;
		background-size: contain, calc(100% - 0.2rem) 100%;
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

</style>
