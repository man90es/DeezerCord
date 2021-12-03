class DeezerCord {
	static token = null

	static init() {
		this.token = localStorage.getItem("token")
		console.log(this.token)
	}
}

DeezerCord.init()
