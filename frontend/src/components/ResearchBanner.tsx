import React from "react";

/**
 * A slim, full-width banner to display at the top of the app.
 * It clearly states that the tool is for research use only
 * and must not be used for clinical purposes.
 */
const ResearchBanner: React.FC = () => {
	return (
		<div className="w-full border-b border-amber-700 bg-amber-900 px-3 py-1 text-xs text-amber-100 md:text-sm">
			<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 text-center">
				<span className="font-semibold uppercase tracking-wide">Research use only</span>
				<span>This tool is not a medical device and must not be used for diagnosis or treatment.</span>
			</div>
		</div>
	);
};

export default ResearchBanner;
