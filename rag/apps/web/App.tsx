import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChatPanel } from "./components/ChatPanel";
import { DocumentViewer } from "./components/DocumentViewer";
import { FileSidebar } from "./components/FileSidebar";
import { type Citation, type DocumentInfo, listDocuments } from "./lib/api";

function App() {
	const [activeDocId, setActiveDocId] = useState<number | null>(null);
	const [activeFilename, setActiveFilename] = useState<string | null>(null);
	const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

	const handleSelectDoc = useCallback((doc: DocumentInfo) => {
		setActiveDocId(doc.id);
		setActiveFilename(doc.filename);
	}, []);

	const handleCitationClick = useCallback(
		async (citation: Citation) => {
			if (citation.documentId !== activeDocId) {
				setActiveDocId(citation.documentId);
				const docs = await listDocuments();
				const doc = docs.find((d) => d.id === citation.documentId);
				if (doc) setActiveFilename(doc.filename);
			}
			setActiveCitation(null);
			requestAnimationFrame(() => setActiveCitation(citation));
		},
		[activeDocId],
	);

	return (
		<div className="app">
			<header className="topbar">
				<div className="topbar-logo">
					<div className="topbar-mark">N</div>
					<span className="topbar-name">
						Nexus Analytics{" "}
						<span className="topbar-by">
							by{" "}
							<a
								href="https://superdoc.dev"
								target="_blank"
								rel="noopener noreferrer"
							>
								SuperDoc
							</a>
						</span>
					</span>
				</div>
			</header>
			<main className="main">
				<FileSidebar activeDocId={activeDocId} onSelectDoc={handleSelectDoc} />
				<DocumentViewer
					documentId={activeDocId}
					citation={activeCitation}
					filename={activeFilename}
				/>
				<ChatPanel onCitationClick={handleCitationClick} />
			</main>
		</div>
	);
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
