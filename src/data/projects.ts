/**
 * Projects shown on /projects/ and counted on the home page.
 * Add a new object to the array to publish another project.
 */

export interface Project {
	name: string;
	tagline: string;
	/** 2–3 sentences */
	description: string;
	features: string[];
	stack: string[];
	status: string;
	github: string;
	tags: string[];
}

export const projects: Project[] = [
	{
		description:
			"VulnGuard là bộ quét lỗ hổng tự host, chạy ngay trên máy của bạn. Nó chạy song song 9 công cụ bảo mật, gộp các finding trùng nhau giữa các tool và dùng AI viết báo cáo phân tích bằng tiếng Việt, để biết lỗi nằm ở đâu và vì sao nó đáng lo. Ở chế độ local-only, dữ liệu quét không rời khỏi máy.",
		features: [
			"Chạy song song SAST, SCA, IaC, container và secrets (Semgrep, Trivy, Checkov, Grype, Gitleaks…)",
			"Gộp finding trùng giữa các công cụ, giảm false positive nhờ AI (Ollama local hoặc Claude API)",
			"Quét web bằng Nuclei trên các URL do Katana crawl",
			"Dashboard rủi ro, đăng nhập và phân quyền ADMIN / ANALYST / VIEWER",
			"Xuất báo cáo PDF tiếng Việt, Markdown và JSON",
		],
		github: "https://github.com/datntpro/VulnGuard",
		name: "VulnGuard",
		stack: ["Python", "FastAPI", "Docker", "Ollama", "Semgrep", "Trivy", "Nuclei"],
		status: "Đang phát triển",
		tagline: "Bộ quét lỗ hổng tự host, giải thích rõ lỗi nằm ở đâu.",
		tags: ["devsecops", "sast", "sca", "security-scanner"],
	},
];
