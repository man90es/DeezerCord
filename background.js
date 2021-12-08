chrome.storage.local.get(["discordToken"], (result) => {
	console.log("Initial Discord token:", result.discordToken)
})

chrome.storage.onChanged.addListener((changes) => {
	for (let [key, { newValue }] of Object.entries(changes)) {
		if (key === "deezerData") {
			console.log("New Deezer status:", newValue)
		} else if (key === "discordToken") {
			console.log("New Discord token:", newValue)
		}
	}
})
