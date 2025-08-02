import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDarkMode } from "@/lib/useDarkMode";
import { Moon, Settings, Sun } from "lucide-react";
import { useState } from "react";

export function SettingsDialog() {
	const [isOpen, setIsOpen] = useState(false);
	const { isDark, setIsDark } = useDarkMode();

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant={isOpen ? "default" : "outline"} size="icon">
					<Settings className="w-5 h-5" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>Adjust user preferences and display options.</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-[auto_1fr] items-center gap-4 text-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						{isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
						<Label htmlFor="theme-toggle">{isDark ? "Dark Mode" : "Light Mode"}</Label>
					</div>
					<Switch id="theme-toggle" checked={isDark} onCheckedChange={(checked) => setIsDark(checked)} />
				</div>
			</DialogContent>
		</Dialog>
	);
}
