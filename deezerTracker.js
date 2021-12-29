/*
	This script runs on Deezer page, watches what songs are played
	and stores the data in the extension's non-synced storage
*/

class DeezerTracker {
	static #data = {}

	static init() {
		// wait for song title to appear before starting to scrape
		const bodyObserver = new MutationObserver((mutationsList, observer) => {
			if (mutationsList.find((mutation) => {
				return [...mutation.addedNodes].find((node) => {
					return node.className === "track-link" && node.innerText.length > 0
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

		// Clear status before closing the tab
		window.onbeforeunload = () => {
			if (DeezerTracker.#data !== null) {
				DeezerTracker.#data = null
				DeezerTracker.#upsyncData()
			}
		}
	}

	static async #startPlayerTracking() {
		// Scrape initial data
		Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapePause(), await DeezerTracker.#scrapeSong(), { updatedAt: +new Date() })

		// Observe pause state change and run the scraper
		const pauseObserver = new MutationObserver(async () => {
			Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapePause(), { updatedAt: +new Date() })
			DeezerTracker.#upsyncData()
		})

		pauseObserver.observe(
			document.querySelector(".svg-icon-group-btn.is-highlight"),
			{ characterData: false, attributes: true, childList: false, subtree: false }
		)

		// Observe song title change and run the scraper
		const songObserver = new MutationObserver(async () => {
			Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapeSong(), { updatedAt: +new Date() })
			DeezerTracker.#upsyncData()
		})

		songObserver.observe(
			document.querySelector(".marquee-content .track-link:first-child"),
			{ characterData: true, attributes: false, childList: false, subtree: true }
		)

		// Scrape data after a short delay after song name appears
		setTimeout(async () => {
			Object.assign(DeezerTracker.#data, await DeezerTracker.#scrapePause(), await DeezerTracker.#scrapeSong(), { updatedAt: +new Date() })
			if (!DeezerTracker.#data.paused) {
				DeezerTracker.#upsyncData()
			}
		}, 3e3)
	}

	// Get paused state and current time from the page
	static async #scrapePause() {
		return {
			paused: "Pause" !== document.querySelector(".svg-icon-group-btn.is-highlight").ariaLabel,
			time:   document.querySelector(".slider-counter.slider-counter-current").innerText,
		}
	}

	// Get song title, artist name, album title and song length from the page
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

	// Copy scraped data to the extension's non-synced storage
	static #upsyncData() {
		chrome.storage.local.set({ deezerData: DeezerTracker.#data })
	}
}

DeezerTracker.init()
