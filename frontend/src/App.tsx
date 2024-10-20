import { useEffect, useRef, useState } from "react";
// import {defineConfig} from 'vite'
// import reactLogo from "./assets/react.svg";
// import viteLogo from "/vite.svg";
import "./App.css";
import { useLocalStorage } from "./hooks";
import {
	COMFY_UI_URL,
	getLoras,
	getModels,
	getWorkflowText,
	load_api_workflows,
	load_outputs,
	socket,
} from "./utils";
import Controls from "./components/Controls";
import Select from "react-dropdown-select";

// console.log({defineConfig})/
function App() {
	const [count, setCount] = useState<number>(0);
	const [isGenerating, setIsGenerating] = useState(false);
	const [workflow, setWorkflow] = useLocalStorage<string>(
		"selectedWorkflow",
		"",
	);
	const [workflows, setWorkflows] = useState<any>(null);
	const [altWorkflow, setAltWorkflow] = useState<any>(null);
	const [loaded, setLoaded] = useState(false);
	const [results, setResults] = useState<
		Array<{
			filename: string;
			subfolder: String;
			random: string;
			tags: string;
			loras: string;
			models: string;
		}>
	>([]);
	const [progress, setProgress] = useState(0);
	const [batch, setBatch] = useLocalStorage("batchRenderOption", 1);
	const [defaultPromptValue, setSufixWorkflowText] = useState(""); // needs to be state
	const resultContainerRef = useRef<HTMLDivElement>(null);

	// from control
	const [promptTags] = useLocalStorage("promptTags", []);

	// get from server
	useEffect(() => {
		if (loaded) return;
		load_api_workflows((workflows: any) => {
			//@ts-ignore
			const [first] = Object.entries(Object.entries(workflows)); //todo make selectable
			const [workflowName] = first[1];
			console.log("==== App Received user workflows ==", { workflows });
			setWorkflow(workflow || (workflowName as any));
			setWorkflows(workflows);
			load_outputs((outputs: any) => {
				const initResults: any = [];
				// const initCollections: any = [];//todo
				Object.keys(outputs).forEach((subfolder: any) => {
					Object.values(outputs[subfolder]).forEach((file: any) => {
						initResults.push({ filename: file.file_name, subfolder });
					});
				});
				setResults(initResults);
			});
		});
	}, [loaded]);
	useEffect(() => {
		if (!loaded && workflows) {
			console.log(
				{ workflows, workflow },
				"======= Loaded user workflows into state",
				workflows,
			);
			onSetCurrentWorkflowData(workflow);
		}
	}, [loaded, workflows, workflow]);
	const onSetCurrentWorkflowData = (key: string) => {
		if (!workflows || !workflow) {
			console.error("Failed to load workflow ", { key, workflow, workflows });
			return;
		}
		const nextKey = key in workflows ? key : Object.keys(workflows)[0];
		if (nextKey !== key) {
			console.error(
				`>>> ${key} fonr found in workflows! Using ${nextKey} instead...`,
				{ workflows },
			);
		}
		setWorkflow(nextKey);
		const nextWorkflow = workflows[nextKey];
		console.log("===== Selecting workflow:: ", {
			nextKey,
			nextWorkflow,
			workflows,
		});
		setAltWorkflow(nextWorkflow);
		const workflowText = getWorkflowText(nextWorkflow);
		setSufixWorkflowText(workflowText);
	};

	const onSocketMessage = (event: any) => {
		const data = JSON.parse(event.data);
		console.log("---", data);
		if (data.type === "progress") {
			// setIsGenerating(true);
			setProgress(data["data"]["max"] - data["data"]["value"]);
			console.info(data["data"]["max"], data["data"]["value"]);

			// updateProgress(data['data']['max'], data['data']['value']);
		} else if (data.type === "executed") {
			const execution_time = 22; //elapsedTime();
			console.log("Execution time: " + execution_time + "s", {
				isGenerating,
				progress,
			});
			if ("images" in data["data"]["output"]) {
				const imageData = data["data"]["output"]["images"];
				if (imageData[0]?.type === "temp") {
					console.log(" -- SKIP --");
					return;
				}
				const loras = getLoras(altWorkflow);
				const models = getModels(altWorkflow);
				setResults((prev) => [
					...prev, // todo must be prev with state, otherwise wont work. This is borked for localStorage and it uses the previous of previous
					...imageData
						.filter(
							(item: any) => !item.filename.toLowerCase().includes("_temp_"),
						)
						.map((item: any) => ({
							filename: item.filename,
							subfolder: item.subfolder,
							random: Math.random(),
							tags: promptTags.map((item: any) => item.value).join(","),
							models,
							loras,
						})),
				]);
				setIsGenerating(false);
				setTimeout(() => {
					if (resultContainerRef.current) {
						resultContainerRef.current.scrollTop =
							resultContainerRef.current.scrollHeight;
						// resultContainerRef.current.click();
					}
				}, 500);
			}
		} else if (data.type === "execution_interrupted") {
			console.log("Execution Interrupted");
			setCount(data["data"]["status"]["exec_info"]["queue_remaining"]);
		} else if (data.type === "status") {
			console.log({ data });
			const remaining = data["data"]["status"]["exec_info"]["queue_remaining"];
			setIsGenerating(remaining > 0);
			setCount(remaining);
		}
	};
	useEffect(() => {
		if (altWorkflow && !loaded) {
			// setAltWorkflow(workflow);
			socket.addEventListener("open", (event) => {
				console.log("============ Connected to the server", { event });
			});
			console.log("========= ADDING SOCKET EVENT LISTENER");
			socket.addEventListener("message", onSocketMessage);
			console.log("🎉🎉🎉🎉 === Initialized! === 🎉🎉🎉🎉🎉");
			setLoaded(true);
		}
	}, [altWorkflow, loaded]);

	if (!loaded) return null;
	const availableWorkflows = Object.keys(workflows ?? {});
	const workflowOptions = availableWorkflows.map((value: any) => ({
		value,
		label: value,
	}));
	const selectedWorkflowProp: any = workflowOptions.find(
		(item) => item.value === workflow,
	) ?? { value: workflow, label: workflow };
	return (
		<>
			<div className="layout-wrapper" id="app-root">
				{results && (
					<div>
						{isGenerating
							? `Rendering ${batch - count + 1} of ${batch} -- Steps: ${progress} Total: ${results.length}`
							: `Total: ${results.length}`}
					</div>
				)}

				<div className="top-half" ref={resultContainerRef}>
					{workflowOptions.length > 0 && (
						<div className="workflow-selector">
							<Select
								options={workflowOptions}
								onChange={(newSelected: any) => {
									console.log({ newSelected });
									onSetCurrentWorkflowData(newSelected[0].value);
								}}
								values={[selectedWorkflowProp]}
								searchable
								dropdownGap={0}
							/>
						</div>
					)}

					<div className="flex">
						{(results ?? []).map((item, index) => (
							<div
								className="output-image"
								key={`${index}-${item.filename}-${item.random}`}
							>
								<img
									src={`${COMFY_UI_URL}/view?filename=${item.filename}&type=output&subfolder=${item.subfolder}&rand=${item.random}
          `}
									width="512"
									height="512"
									title={`workflow:${workflow}\nfilename: ${item.filename}\ncollection: ${item.subfolder}\n\ntags: ${item.tags ?? ""}\n(seed: ${item.random})\n\nmodels: ${item.models ?? ""}\n\nloras: ${item.loras ?? ""}`}
									alt={item.filename}
									className="result-image"
								></img>
							</div>
						))}
					</div>
				</div>
				<div className="bottom-half">
					{altWorkflow && (
						<Controls
							workflow={workflows[workflow]}
							workflowName={workflow}
							altWorkflow={altWorkflow}
							setAltWorkflow={setAltWorkflow}
							isGenerating={isGenerating}
							progress={progress}
							count={count}
							batch={batch}
							setBatch={setBatch}
							defaultPromptValue={defaultPromptValue}
						></Controls>
					)}
					{!workflow && <div>No workflow found</div>}
				</div>
			</div>
		</>
	);
}

export default App;
