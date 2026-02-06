export namespace main {
	
	export class KillResult {
	    pid: string;
	    success: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new KillResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.success = source["success"];
	        this.message = source["message"];
	    }
	}
	export class ProcessInfo {
	    command: string;
	    pid: string;
	    user: string;
	    fd: string;
	    type: string;
	    device: string;
	    sizeOff: string;
	    node: string;
	    name: string;
	    port: string;
	    protocol: string;
	    state: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command = source["command"];
	        this.pid = source["pid"];
	        this.user = source["user"];
	        this.fd = source["fd"];
	        this.type = source["type"];
	        this.device = source["device"];
	        this.sizeOff = source["sizeOff"];
	        this.node = source["node"];
	        this.name = source["name"];
	        this.port = source["port"];
	        this.protocol = source["protocol"];
	        this.state = source["state"];
	    }
	}

}

