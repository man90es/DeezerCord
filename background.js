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
		if (DeezerCord.#heartbeatInterval !== null) {
			clearInterval(DeezerCord.#heartbeatInterval)
			DeezerCord.#heartbeatInterval = null
		}

		// Initialise a websocket connection to Deezer
		DeezerCord.#ws = new WebSocket("wss://gateway.discord.gg/?v=6&encoding=json")
		DeezerCord.#ws.onopen = () => {
			console.log("Connection open")
			DeezerCord.#send(DeezerCord.#generateOpIdentifyPayload())
		}
		DeezerCord.#ws.onmessage = (e) => {
			DeezerCord.#handleMessage(e.data)
		}
		DeezerCord.#ws.onclose = (e) => {
			console.log("Connection closed", e)
		}
	}

	static #setDiscordToken(token) {
		DeezerCord.#discordToken = token

		if (token) {
			DeezerCord.#openWS()
		}
	}

	static #setDeezerStatus(status) {
		DeezerCord.#deezerStatus = status
		DeezerCord.#send(DeezerCord.#generateOpPresenceUpdatePayload())
	}

	static #setHeartbeatInterval(interval) {
		if (DeezerCord.#heartbeatInterval !== null) {
			clearInterval(DeezerCord.#heartbeatInterval)
		}

		DeezerCord.#heartbeatInterval = setInterval(() => {
			DeezerCord.#send(DeezerCord.#generateOpHeartbeatPayload())
		}, interval)
	}

	static #send(payload) {
		DeezerCord.#ws.send(JSON.stringify(payload))
	}

	static #handleMessage(message) {
		const msg = JSON.parse(message)
		DeezerCord.#lastSeq = msg.s

		switch (msg.op) {
			case 1: // "Heartbeat"
				DeezerCord.#send(DeezerCord.#generateOpHeartbeatPayload())
				break

			case 9: // "Invalid Session"
				DeezerCord.#send(DeezerCord.#generateOpIdentifyPayload())
				break

			case 10: // "Hello"
				DeezerCord.#setHeartbeatInterval(msg.d.heartbeat_interval)
				break
		}

	}

	static #generatePresenceStatus() {
		const noStatus = DeezerCord.#deezerStatus === null || DeezerCord.#deezerStatus.paused

		const game = noStatus ? null : {
			name:     "Deezer",
			type:     2, // "Listening to"
			details:  DeezerCord.#deezerStatus.song,
			state:    "by " + DeezerCord.#deezerStatus.artist,
			instance: false,
		}

		return {
			game,
			status: "online",
			since: null,
			afk: false,
		}
	}

	static #generateOpHeartbeatPayload() {
		return {
			op: 1, // "Heartbeat"
			d: DeezerCord.#lastSeq,
		}
	}

	static #generateOpIdentifyPayload() {
		return {
			op: 2, // "Identify"
			d: {
				token: DeezerCord.#discordToken,
				properties: {
					$os:      Utils.getPlatformName(),
					$browser: Utils.getBrowserName(),
					$device:  Utils.getDeviceName(),
				},
				compress: false,
				large_threshold: 50,
				presence: DeezerCord.#generatePresenceStatus(),
			}
		}
	}

	static #generateOpPresenceUpdatePayload() {
		return {
			op: 3, // "Presence Update"
			d: DeezerCord.#generatePresenceStatus(),
		};
	}
}

DeezerCord.init()
