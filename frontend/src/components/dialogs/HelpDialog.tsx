import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

export function HelpDialog() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant={isOpen ? "default" : "outline"} size="icon">
					<CircleHelp className="w-5 h-5" />
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-secondary">
				<DialogHeader>
					<DialogTitle>Help</DialogTitle>
					<DialogDescription>Description.</DialogDescription>
				</DialogHeader>
				<div className="text-sm space-y-2">
					<p>Paragraph 1.</p>
					<p>Paragraph 2.</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
