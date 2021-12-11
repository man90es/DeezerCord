/*
	This script runs on Discord page, extracts the session token
	and stores it in the extension's non-synced storage
*/

(() => {
	const token = localStorage.getItem("token").replaceAll("\"", "")
	chrome.storage.local.set({ discordToken: token })
})()
