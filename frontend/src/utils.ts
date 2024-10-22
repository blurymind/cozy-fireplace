export const COMFY_UI_PORT = 8188;
export const COMFY_UI_URL = `http://${window.location.hostname}:${COMFY_UI_PORT}`;
export const seed = () => {
	return Math.floor(Math.random() * 9999999999);
};
//@ts-ignore
export const uuidv4 = () => {
	//@ts-ignore
	return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
		/[018]/g,
		//@ts-ignore
		(c) =>
			(
				c ^
				(crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
			).toString(16),
	);
};
export const CLIENT_ID = uuidv4();
export const SERVER_ADDRESS = window.location.hostname + ":" + COMFY_UI_PORT;
export const PROMPT_TIME = 1000;
export let fetched = false; // to prevent react from creating two websockets at the useEffect mount
export const load_api_workflows = (onDone: any) => {
	if (fetched) return;
	console.log("Fetching workflows...");
	fetched = true;
	fetch(`${COMFY_UI_URL}/fireplace/workflows.json`)
		.then((res) => res.json())
		.then((data) => {
			console.log("---- received workflows!");
			onDone(data);
		})
		.catch(() => onDone({})); // generated by the pyton server
};
export const load_outputs = (onDone: any) => {
	fetch(`${COMFY_UI_URL}/fireplace/fs`)
		.then((res) => res.json())
		.then((data) => {
			onDone(data);
		})
		.catch((e) => {
			console.error(e);
			onDone({});
		});
};

export const move_outputs = (
	files: any,
	subfolder: string,
	workflow: string,
	onDone: any,
) => {
	console.log({
		subfolder,
		files,
	});
	fetch(`${COMFY_UI_URL}/fireplace/fs-move`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			subfolder,
			files,
			workflow,
		}),
	})
		.then((res) => res.json())
		.then((result: any) => {
			onDone(result);
		})
		.catch((e) => {
			console.error(e);
			onDone();
		});
};
export const rename_collection = (from: string, to: string, onDone: any) => {
	fetch(`${COMFY_UI_URL}/fireplace/fs-rename`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
			to,
		}),
	})
		.then((res) => res.json())
		.then((result: any) => {
			onDone(result);
		})
		.catch((e) => {
			console.error(e);
			onDone();
		});
};
export const create_collection = (collection: string, onDone: any) => {
	fetch(`${COMFY_UI_URL}/fireplace/fs-create`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			collection,
		}),
	})
		.then((res) => res.json())
		.then((result: any) => {
			onDone(result);
		})
		.catch((e) => {
			console.error(e);
			onDone();
		});
};
export const PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";

export const queue_prompt = async (prompt = {}) => {
	const data = { prompt: prompt, client_id: CLIENT_ID };

	console.log("Prompt ");
	const response = await fetch(`http://${SERVER_ADDRESS}/prompt`, {
		method: "POST",
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});

	return await response.json();
};
// @ts-ignore
export const getWorkflowPromptNode = (workflow: any): any => {
	const node = Object.entries(workflow).find(([_, node]) => {
		if (
			//@ts-ignore
			node.class_type === "CLIPTextEncode" &&
			//@ts-ignore
			!node.inputs.text.toLowerCase().startsWith("negative")
		) {
			//   key = nodeKey;
			return true;
		}
		return false;
	});
	return node;
};

// @ts-ignore
export const getSeedNodeKey = (altWorkflow: any): any => {
	console.log({ altWorkflow });
	const result = Object.entries(altWorkflow).find(([_, node]) => {
		if (
			//@ts-ignore
			node.class_type === "RandomNoise" &&
			//@ts-ignore
			"noise_seed" in node.inputs
		) {
			return true;
		}
		if (
			//@ts-ignore
			node.class_type === "KSampler" &&
			//@ts-ignore
			"seed" in node.inputs
		) {
			return true;
		}
		return false;
	}) ?? ["0"];

	// console.log({ result, altWorkflow });
	return result[0]; // {...result, noise_seed: seed};
};

export const getMutatedWorkflow = (workflow: any, prompt: string) => {
	const [textNodeKey] = getWorkflowPromptNode(workflow);
	const seedNodeKey = getSeedNodeKey(workflow);
	return {
		...workflow,
		[textNodeKey]: {
			...workflow[textNodeKey],
			inputs: { ...workflow[textNodeKey].inputs, text: prompt },
		},
		[seedNodeKey]: {
			...workflow[seedNodeKey],
			inputs: { ...workflow[seedNodeKey].inputs, noise_seed: seed() },
		},
	};
};
export const getWorkflowText = (workflow: any) => {
	const [_, workflowNode] = getWorkflowPromptNode(workflow);
	// console.log({ workflowNode });
	if (!workflowNode) return "";
	//@ts-ignore
	return workflowNode.inputs.text;
};
export const getInput = (query: string, sufixWorkflowText: string) => {
	return query.replace(/(\r\n|\n|\r|\")/gm, " ") + "," + sufixWorkflowText;
};

export const socket = new WebSocket(
	PROTOCOL + "//" + SERVER_ADDRESS + "/ws?clientId=" + CLIENT_ID,
);
// todo move to utils
export const getLoras = (altWorkflow: any) => {
	const result = Object.values(altWorkflow)
		.filter((item: any) => item.class_type === "LoraLoader")
		.map(
			(item: any) => `${item.inputs.lora_name} (${item.inputs.strength_model})`,
		)
		.join(",\n");
	return result;
};
export const getModels = (altWorkflow: any) => {
	const result = Object.values(altWorkflow)
		.filter((item: any) => item.class_type.startsWith("CheckpointLoader"))
		.map((item: any) => `${item.inputs.ckpt_name.split(".")[0]}`)
		.join(",\n");
	return result;
};
