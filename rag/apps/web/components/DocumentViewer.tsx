import { useEffect, useRef, useState } from "react";
import { createTheme, SuperDoc } from "superdoc";
import "superdoc/style.css";

const docragTheme = createTheme({
	name: "docrag",
	font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
	colors: {
		action: "#0070F3",
		actionHover: "#005CC5",
		actionText: "#FFFFFF",
		bg: "#FFFFFF",
		text: "#000000",
		textMuted: "#888888",
		border: "#E5E5E5",
	},
	vars: {
		"--sd-ui-comments-card-bg": "#F0F7FF",
		"--sd-ui-comments-card-hover-bg": "#E0EFFF",
		"--sd-ui-comments-card-active-bg": "#FFFFFF",
		"--sd-ui-comments-card-active-border": "#0070F3",
		"--sd-ui-comments-card-shadow": "0px 4px 12px 0px rgba(0, 112, 243, 0.12)",
		"--sd-comments-highlight-external": "#0070F340",
		"--sd-comments-highlight-external-active": "#0070F366",
		"--sd-comments-highlight-external-faded": "#0070F320",
		"--sd-comments-highlight-hover": "#0070F355",
		"--sd-comments-selection-background": "#0070F355",
	},
});

import { type Citation, getDocumentFileUrl } from "../lib/api";

type Props = {
	documentId: number | null;
	citation: Citation | null;
	filename: string | null;
};

export function DocumentViewer({ documentId, citation, filename }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const superdocRef = useRef<any>(null);
	const [docFile, setDocFile] = useState<File | null>(null);
	const [fetchedDocId, setFetchedDocId] = useState<number | null>(null);

	// Step 1: Fetch the file when documentId changes
	useEffect(() => {
		if (!documentId || documentId === fetchedDocId) return;

		fetch(getDocumentFileUrl(documentId))
			.then((r) => r.arrayBuffer())
			.then((buf) => {
				const file = new File([buf], filename ?? "document.docx", {
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				});
				setDocFile(file);
				setFetchedDocId(documentId);
			})
			.catch((e) => console.error("Failed to load doc:", e));
	}, [documentId, fetchedDocId, filename]);

	// Step 2: Mount SuperDoc when we have a file + container
	useEffect(() => {
		if (!docFile || !containerRef.current) return;

		superdocRef.current?.destroy();
		containerRef.current.classList.add(docragTheme);
		superdocRef.current = new SuperDoc({
			selector: containerRef.current,
			document: docFile,
			documentMode: "viewing",
			comments: { visible: true },
			trackChanges: { visible: true },
		});

		return () => {
			superdocRef.current?.destroy();
			superdocRef.current = null;
		};
	}, [docFile]);

	// Step 3: Navigate to citation by ID
	useEffect(() => {
		if (!citation || !docFile || !superdocRef.current) return;

		const sd = superdocRef.current;
		sd.scrollToElement(citation.targetId);
	}, [citation, docFile]);

	if (!documentId) {
		return (
			<div className="viewer-panel">
				<div className="viewer-placeholder">
					<div className="viewer-placeholder-icon">
						<svg
							width="24"
							height="24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="1.5"
						>
							<path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
							<path d="M17 20v-8H7v8M7 4v4h6" />
						</svg>
					</div>
					<span className="viewer-placeholder-text">
						Select a document from the sidebar
						<br />
						to open it here.
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="viewer-panel">
			<div className="viewer-header">
				<span className="viewer-header-icon">
					<svg
						width="14"
						height="14"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
						<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
					</svg>
				</span>
				{filename}
			</div>
			<div ref={containerRef} className="viewer-container" />
		</div>
	);
}
