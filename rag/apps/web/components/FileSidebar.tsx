import { useCallback, useEffect, useRef, useState } from "react";
import { type DocumentInfo, ingestDocument, listDocuments } from "../lib/api";

type FileEntry = {
	key: string;
	filename: string;
	docId?: number;
	status: "ready" | "queued" | "extracting" | "error";
	detail?: string;
};

type Props = {
	activeDocId: number | null;
	onSelectDoc: (doc: DocumentInfo) => void;
};

let entrySeq = 0;

export function FileSidebar({ activeDocId, onSelectDoc }: Props) {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [documents, setDocuments] = useState<DocumentInfo[]>([]);
	const fileRef = useRef<HTMLInputElement>(null);

	const refreshDocs = useCallback(async () => {
		const docs = await listDocuments();
		setDocuments(docs);
		setEntries((prev) => {
			const processing = prev.filter(
				(e) => e.status !== "ready" && e.status !== "error",
			);
			const ready: FileEntry[] = docs
				.filter((d) => !processing.some((p) => p.docId === d.id))
				.map((d) => ({
					key: `doc-${d.id}`,
					filename: d.filename,
					docId: d.id,
					status: "ready",
				}));
			return [...processing, ...ready];
		});
	}, []);

	useEffect(() => {
		refreshDocs();
	}, [refreshDocs]);

	function updateEntry(key: string, update: Partial<FileEntry>) {
		setEntries((prev) =>
			prev.map((e) => (e.key === key ? { ...e, ...update } : e)),
		);
	}

	async function processFile(file: File, key: string) {
		try {
			updateEntry(key, { status: "extracting" });
			const result = await ingestDocument(file);
			updateEntry(key, {
				status: "ready",
				docId: result.documentId,
			});
			refreshDocs();
		} catch (err) {
			updateEntry(key, {
				status: "error",
				detail: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	async function handleFiles(files: FileList) {
		const docxFiles = Array.from(files).filter((f) => f.name.endsWith(".docx"));
		if (docxFiles.length === 0) return;

		const jobs: { file: File; key: string }[] = [];
		setEntries((prev) => {
			const newEntries: FileEntry[] = docxFiles.map((f) => {
				const key = `upload-${++entrySeq}`;
				jobs.push({ file: f, key });
				return { key, filename: f.name, status: "queued" };
			});
			return [...prev, ...newEntries];
		});

		await Promise.all(jobs.map((j) => processFile(j.file, j.key)));
	}

	function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.files?.length) {
			handleFiles(e.target.files);
			e.target.value = "";
		}
	}

	function handleClick(entry: FileEntry) {
		if (entry.status !== "ready" || !entry.docId) return;
		const doc = documents.find((d) => d.id === entry.docId);
		if (doc) onSelectDoc(doc);
	}

	const STATUS_LABEL: Record<string, string> = {
		queued: "Queued",
		extracting: "Processing...",
		error: "Error",
	};

	return (
		<div className="file-sidebar">
			<div className="file-sidebar-header">
				<span className="file-sidebar-title">Documents</span>
				<input
					ref={fileRef}
					type="file"
					accept=".docx"
					multiple
					hidden
					onChange={handleFileInput}
				/>
				<button
					type="button"
					className="btn-upload"
					onClick={() => fileRef.current?.click()}
				>
					+ Add
				</button>
			</div>
			<div className="file-list">
				{entries.length === 0 && (
					<div className="file-empty">No documents yet</div>
				)}
				{entries.map((entry) => (
					<button
						type="button"
						key={entry.key}
						className={`file-item ${entry.docId === activeDocId ? "active" : ""} ${entry.status !== "ready" ? "file-item--processing" : ""}`}
						onClick={() => handleClick(entry)}
						disabled={entry.status !== "ready"}
					>
						<span className="file-item-name">
							<span
								className={`file-item-dot file-item-dot--${entry.status}`}
							/>
							{entry.filename}
						</span>
						{entry.status !== "ready" && (
							<span className="file-item-progress">
								{entry.detail ?? STATUS_LABEL[entry.status]}
							</span>
						)}
					</button>
				))}
			</div>
		</div>
	);
}
