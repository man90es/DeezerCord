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
	static #heartbeatInterval = 41250
	static #discordToken = null
	static #deezerStatus = null
	static #ws = null

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
		// Initialise a websocket connection to Deezer
		DeezerCord.#ws = new WebSocket("wss://gateway.discord.gg/?v=6&encoding=json")
		DeezerCord.#ws.onopen = () => {
			DeezerCord.#send(DeezerCord.#generateOpIdentifyPayload())
		}
		DeezerCord.#ws.onmessage = (e) => {
			DeezerCord.#handleMessage(e.data)
		}
	}

	static #setDiscordToken(token) {
		DeezerCord.#discordToken = token
	}

	static #setDeezerStatus(status) {
		DeezerCord.#deezerStatus = status

		if (DeezerCord.#ws === null) {
			DeezerCord.#openWS()
		}
	}

	static #setHeartbeatInterval(interval) {
		DeezerCord.#heartbeatInterval = interval
	}

	static #send(payload) {
		DeezerCord.#ws.send(JSON.stringify(payload))
	}

	static #handleMessage(message) {
		const msg = JSON.parse(message)

		if (msg.op === 10) {
			DeezerCord.#setHeartbeatInterval(msg.d.heartbeat_interval)
		} else {
			console.log(msg)
		}
	}

	static #generatePresenceStatus() {
		const game = DeezerCord.#deezerStatus === null ? null : {
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
}

DeezerCord.init()
