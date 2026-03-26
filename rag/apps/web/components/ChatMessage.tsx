import type { Citation } from "../lib/api";

type Props = {
	role: "user" | "assistant";
	content: string;
	citations?: Citation[];
	loading?: boolean;
	onCitationClick?: (citation: Citation) => void;
};

const TYPE_LABELS: Record<string, string> = {
	body: "paragraph",
	comment: "comment",
	tracked_change: "change",
};

export function ChatMessage({
	role,
	content,
	citations,
	loading,
	onCitationClick,
}: Props) {
	if (loading) {
		return <div className="message message-loading">Analyzing documents</div>;
	}
	if (role === "user") {
		return <div className="message message-user">{content}</div>;
	}

	const parts = content.split(/(\[\d+\])/g);

	return (
		<div className="message message-assistant">
			<span>
				{parts.map((part) => {
					const m = part.match(/^\[(\d+)\]$/);
					if (m) {
						const idx = parseInt(m[1], 10);
						const cite = citations?.find((c) => c.index === idx);
						if (cite) {
							return (
								<button
									type="button"
									key={`cite-${idx}`}
									className="citation-link"
									title={`${cite.filename}: ${cite.snippet}`}
									onClick={() => onCitationClick?.(cite)}
								>
									{idx}
								</button>
							);
						}
					}
					return <span key={`text-${part}`}>{part}</span>;
				})}
			</span>
			{citations && citations.length > 0 && (
				<div className="citations-list">
					{citations.map((c) => (
						<button
							type="button"
							key={c.index}
							className="citation-card"
							data-type={c.targetType}
							onClick={() => onCitationClick?.(c)}
						>
							<span className="citation-card-number">{c.index}</span>
							<span className="citation-card-content">
								<span className="citation-card-label">
									{c.filename}
									<span className="citation-card-type">
										{TYPE_LABELS[c.contextType] ?? c.contextType}
									</span>
								</span>
								<span className="citation-card-snippet">{c.snippet}</span>
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
