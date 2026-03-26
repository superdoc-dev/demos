import { useEffect, useRef, useState } from "react";
import { createTheme, SuperDoc } from "superdoc";
import "superdoc/style.css";

// Nexus Analytics brand theme for the SuperDoc editor
const nexusTheme = createTheme({
	name: "nexus",
	font: "'DM Sans', 'Inter', sans-serif",
	colors: {
		action: "#E67E22",
		actionHover: "#D35400",
		actionText: "#FFFFFF",
		bg: "#FFFFFF",
		text: "#1E293B",
		textMuted: "#64748B",
		border: "#E2E8F0",
	},
	vars: {
		// Comment card styling — override computed vars directly
		"--sd-ui-comments-card-bg": "#FEF7ED",
		"--sd-ui-comments-card-hover-bg": "#FEF0DB",
		"--sd-ui-comments-card-active-bg": "#FFFFFF",
		"--sd-ui-comments-card-active-border": "#E67E22",
		"--sd-ui-comments-card-shadow": "0px 4px 12px 0px rgba(230, 126, 34, 0.12)",
		// Comment text highlights in the document
		"--sd-comments-highlight-external": "#E67E2240",
		"--sd-comments-highlight-external-active": "#E67E2266",
		"--sd-comments-highlight-external-faded": "#E67E2220",
		"--sd-comments-highlight-hover": "#E67E2255",
		"--sd-comments-selection-background": "#E67E2255",
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
		containerRef.current.classList.add(nexusTheme);
		superdocRef.current = new SuperDoc({
			selector: containerRef.current,
			document: docFile,
			documentMode: "editing",
			comments: { visible: true },
			trackChanges: { visible: true },
		});

		return () => {
			superdocRef.current?.destroy();
			superdocRef.current = null;
		};
	}, [docFile]);

	// Step 3: Navigate to citation using SuperDoc search
	// Depends on docFile so it re-runs after a cross-doc switch loads the new viewer
	useEffect(() => {
		if (!citation || !docFile || !superdocRef.current) return;

		const sd = superdocRef.current;

		// Pick the right text to search for based on citation type:
		// - comments: search for the anchored text (the text the comment is on)
		// - tracked changes: search for the excerpt text in the document
		// - body: search for the paragraph content
		let searchText: string;
		if (citation.targetType === "comment" && citation.anchoredText) {
			searchText = citation.anchoredText;
		} else if (citation.targetType === "track-change") {
			searchText = citation.snippet
				.replace(/^\[.*?\]:\s*/, "")
				.replace(/^"(.*)"$/, "$1");
		} else {
			searchText = citation.snippet;
		}
		searchText = searchText.slice(0, 60).trim();

		if (!searchText) return;

		let cancelled = false;
		const trySearch = () => {
			if (cancelled || superdocRef.current !== sd) return;
			const matches = sd.search(searchText);
			if (matches?.length) {
				sd.goToSearchResult(matches[0]);
			}
		};

		// Retry with increasing delays to handle slow document loads
		const t1 = setTimeout(trySearch, 300);
		const t2 = setTimeout(trySearch, 1000);
		const t3 = setTimeout(trySearch, 2500);
		trySearch();

		return () => {
			cancelled = true;
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
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
