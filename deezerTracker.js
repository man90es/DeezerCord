/*
	This script runs on Deezer page, watches what songs are played
	and stores the data in the extension's non-synced storage
*/

class DeezerTracker {
	static #initialised = false
	static #data = {}

	static init() {
		if (DeezerTracker.#initialised) {
			return
		}

		DeezerTracker.#initialised = true

		const bodyObserver = new MutationObserver((mutationsList, observer) => {
			if (mutationsList.find((mutation) => {
				return [...mutation.addedNodes].find((node) => {
					return node.className === 'track-link' && node.innerText.length > 0
				})
			})) {
				DeezerTracker.#startPlayerTracking()
				observer.disconnect()
			}
		})

		bodyObserver.observe(
			document.querySelector("body"),
			{ characterData: false, attributes: false, childList: true, subtree: true }
		)
	}

	static async #startPlayerTracking() {
		Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapePause(), await DeezerTracker.#scrapeSong(), { updatedAt: +new Date() })

		const pauseObserver = new MutationObserver(async (mutationsList, observer) => {
			Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapePause(), { updatedAt: +new Date() })
			DeezerTracker.#upsyncData()
		})

		pauseObserver.observe(
			document.querySelector(".svg-icon-group-btn.is-highlight"),
			{ characterData: false, attributes: true, childList: false, subtree: false }
		)

		const songObserver = new MutationObserver(async (mutationsList, observer) => {
			Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapeSong(), { updatedAt: +new Date() })
			DeezerTracker.#upsyncData()
		})

		songObserver.observe(
			document.querySelector(".marquee-content .track-link:first-child"),
			{ characterData: true, attributes: false, childList: false, subtree: true }
		)
	}

	static async #scrapePause() {
		return {
			paused: "Pause" !== document.querySelector(".svg-icon-group-btn.is-highlight").ariaLabel,
			time:   document.querySelector(".slider-counter.slider-counter-current").innerText,
		}
	}

	static async #scrapeSong() {
		const albumId = document.querySelector(".marquee-content .track-link:first-child").href.split("/").pop()
		const album = await fetch(`https://api.deezer.com/album/${albumId}`)
			.then(response => {
				if (response.ok && 200 === response.status) {
					return response.json()
				} else {
					throw new Error(response.statusText)
				}
			})

		// The first song in the flow doesn't have length for a while after starting
		const length = await (async () => {
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve(document.querySelector(".slider-counter.slider-counter-max").innerText)
				}, 500)
			})
		})()

		return {
			song:   document.querySelector(".marquee-content .track-link:first-child").innerText,
			artist: document.querySelector(".marquee-content .track-link:last-child").innerText,
			album:  album.title,
			length: length,
		}
	}

	static #upsyncData() {
		chrome.storage.local.set({ deezerData: DeezerTracker.#data })
	}
}

DeezerTracker.init()
