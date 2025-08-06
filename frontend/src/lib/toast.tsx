import { toast } from "sonner";

export function showError(message: string, description?: string) {
	toast.error(message, {
		description,
	});
}

export function showSuccess(message: string, description?: string) {
	toast.success(message, {
		description,
	});
}
