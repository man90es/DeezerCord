/*
	This script runs in the background,
	receives data from Discord and Deezer
	and uploads the current presence status to Deezer
*/

class Utils {
	static getPlatformName() {
		return navigator?.userAgentData?.platform || navigator?.platform || "Unknown"
	}

	static getBrowserName() {
		return navigator.brave ? "Brave" : "Chrome"
	}

	static getDeviceName() {
		return "DeezerCord"
	}

	static timeStringToSeconds(str) {
		str ??= "00:00"
		const [minutes, seconds] = str.split(":")
		return parseInt(minutes) * 60 + parseInt(seconds)
	}
}

class DeezerCord {
	static #heartbeatInterval = null
	static #discordToken = null
	static #deezerStatus = null
	static #ws = null
	static #lastSeq = null

	static init() {
		// Initialise Discord token if it was set in a previous session
		chrome.storage.local.get(["discordToken"], (result) => {
			DeezerCord.#setDiscordToken(result.discordToken)
		})

		// Watch for Discord token and Deezer status changes
		chrome.storage.onChanged.addListener((changes) => {
			for (let [key, { newValue }] of Object.entries(changes)) {
				if (key === "deezerData") {
					DeezerCord.#setDeezerStatus(newValue)
				} else if (key === "discordToken") {
					DeezerCord.#setDiscordToken(newValue)
				}
			}
		})
	}

	static #openWS() {
		// Clear hearbeat interval if it's set
		if (DeezerCord.#heartbeatInterval !== null) {
			clearInterval(DeezerCord.#heartbeatInterval)
			DeezerCord.#heartbeatInterval = null
		}

		// Close previous connection if it's not closed
		if (DeezerCord.#ws?.readyState < 2) {
			DeezerCord.#ws.onclose = () => false
			DeezerCord.#ws.close()
		}

		// Initialise a websocket connection to Deezer
		DeezerCord.#ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json")
		DeezerCord.#ws.onopen = () => {
			console.log("Connection open")
			DeezerCord.#sendOpIdentifyPayload()
		}
		DeezerCord.#ws.onmessage = (e) => {
			DeezerCord.#handleMessage(e.data)
		}
		DeezerCord.#ws.onclose = (e) => {
			console.log("Connection closed for reason:", e.reason)
			console.log("Trying to reconnect...")
			DeezerCord.#openWS()
		}
	}

	// Update used token
	static #setDiscordToken(token) {
		DeezerCord.#discordToken = token

		if (token) {
			DeezerCord.#openWS()
		}
	}

	// Update presence status
	static #setDeezerStatus(status) {
		DeezerCord.#deezerStatus = status
		DeezerCord.#sendOpPresenceUpdatePayload()
	}

	// Discord servers requires a heartbeat signal
	// to be sent each n seconds
	static #setHeartbeatInterval(interval) {
		if (DeezerCord.#heartbeatInterval !== null) {
			clearInterval(DeezerCord.#heartbeatInterval)
		}

		DeezerCord.#heartbeatInterval = setInterval(() => {
			DeezerCord.#sendOpHeartbeatPayload()

			// If more than a minute on pause, clear presence status
			if (DeezerCord.#deezerStatus?.paused && +new Date() - DeezerCord.#deezerStatus?.updatedAt > 6e4) {
				DeezerCord.#setDeezerStatus(null)
			}
		}, interval)
	}

	// Decode and handle messages from Discord
	static #handleMessage(message) {
		const msg = JSON.parse(message)
		DeezerCord.#lastSeq = msg.s

		switch (msg.op) {
			case 1: // Extra heartbeat request
				DeezerCord.#sendOpHeartbeatPayload()
				break

			case 9: // "Invalid Session"
				DeezerCord.#sendOpIdentifyPayload()
				break

			case 10: // "Hello"
				DeezerCord.#setHeartbeatInterval(msg.d.heartbeat_interval)
				break
		}

	}

	// Transform data received from Discord into
	// something Discord can understand and send it
	static #generatePresenceStatus() {
		let game = null

		if (DeezerCord.#deezerStatus !== null) {
			const started = Utils.timeStringToSeconds(DeezerCord.#deezerStatus.time)
			const ends = Utils.timeStringToSeconds(DeezerCord.#deezerStatus.length) - started

			game = {
				name:           "Deezer",
				application_id: "847124807401340958",
				type:           2, // "Listening to"
				details:        DeezerCord.#deezerStatus.song,
				state:          "by " + DeezerCord.#deezerStatus.artist,
				instance:       false, // TODO: find out what it's for
				assets: {
					large_image: "847129160992292925",
					small_image: DeezerCord.#deezerStatus.paused ? "921025520014094396" : null,
					small_text:  "Paused",
				},
				timestamps: {
					start: DeezerCord.#deezerStatus.updatedAt - started * 1e3,
					end:   DeezerCord.#deezerStatus.updatedAt + ends * 1e3,
				},
			}
		}

		return {
			game,
			status: "online",
			since:  null,
			afk:    false,
		}
	}

	// Generate a heartbeat signal and send it
	static #sendOpHeartbeatPayload() {
		const payload = {
			op: 1, // "Heartbeat"
			d: DeezerCord.#lastSeq,
		}

		DeezerCord.#ws.send(JSON.stringify(payload))
	}

	// Generate an authentication payload and send it
	static #sendOpIdentifyPayload() {
		const payload = {
			op: 2, // "Identify"
			d: {
				token: DeezerCord.#discordToken,
				properties: {
					$os:      Utils.getPlatformName(),
					$browser: Utils.getBrowserName(),
					$device:  Utils.getDeviceName(),
				},
				compress:        false,
				large_threshold: 50,
				presence:        DeezerCord.#generatePresenceStatus(),
			}
		}

		DeezerCord.#ws.send(JSON.stringify(payload))
	}

	// Generate a presence update payload and send it
	static #sendOpPresenceUpdatePayload() {
		const payload = {
			op: 3, // "Presence Update"
			d: DeezerCord.#generatePresenceStatus(),
		}

		DeezerCord.#ws.send(JSON.stringify(payload))
	}
}

DeezerCord.init()
