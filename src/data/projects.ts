/**
 * Projects shown on /projects/ and counted on the home page.
 * Add a new object to the array to publish another project.
 */

import type { ImageMetadata } from "astro";
import riskDark from "@/assets/projects/vulnguard/dashboard-risk-dark.webp";
import riskLight from "@/assets/projects/vulnguard/dashboard-risk-light.webp";
import invDark from "@/assets/projects/vulnguard/asset-inventory-dark.webp";
import invLight from "@/assets/projects/vulnguard/asset-inventory-light.webp";
import conDark from "@/assets/projects/vulnguard/connector-list-dark.webp";
import conLight from "@/assets/projects/vulnguard/connector-list-light.webp";
import drawDark from "@/assets/projects/vulnguard/asset-drawer-dark.webp";
import drawLight from "@/assets/projects/vulnguard/asset-drawer-light.webp";
import login from "@/assets/projects/vulnguard/login.webp";

export interface ProjectScreenshot {
	/** Dark-theme image (also the fallback) */
	src: ImageMetadata;
	/** Light-theme variant, if one exists */
	light?: ImageMetadata;
	alt: string;
	caption: string;
}

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
	/** Optional logo path under /public (e.g. /images/projects/x.svg) */
	logo?: string;
	/** Optional brand gradient (135deg) used for accents */
	brand?: { from: string; to: string };
	/** Optional wordmark split: [plain part, gradient part] */
	wordmark?: [string, string];
	/** Optional gallery; the first item is the large hero image */
	screenshots?: ProjectScreenshot[];
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
		brand: { from: "#5B5BF7", to: "#2DD4E8" },
		github: "https://github.com/datntpro/VulnGuard",
		logo: "/images/projects/vulnguard.svg",
		name: "VulnGuard",
		stack: ["Python", "FastAPI", "Docker", "Ollama", "Semgrep", "Trivy", "Nuclei"],
		wordmark: ["Vuln", "Guard"],
		screenshots: [
			{
				alt: "Dashboard rủi ro của VulnGuard: điểm rủi ro tổng thể và số phát hiện theo từng nguồn quét",
				caption: "Dashboard rủi ro",
				light: riskLight,
				src: riskDark,
			},
			{
				alt: "Màn hình Asset Inventory liệt kê tài sản cùng mức độ rủi ro của từng tài sản",
				caption: "Asset Inventory",
				light: invLight,
				src: invDark,
			},
			{
				alt: "Danh sách các kết nối XDR và NAC mà VulnGuard đồng bộ dữ liệu tài sản",
				caption: "Kết nối XDR / NAC",
				light: conLight,
				src: conDark,
			},
			{
				alt: "Ngăn chi tiết một tài sản (asset drawer) với các phát hiện liên quan",
				caption: "Chi tiết tài sản",
				light: drawLight,
				src: drawDark,
			},
			{
				alt: "Màn hình đăng nhập VulnGuard",
				caption: "Đăng nhập",
				src: login,
			},
		],
		status: "Đang phát triển",
		tagline: "Bộ quét lỗ hổng tự host, giải thích rõ lỗi nằm ở đâu.",
		tags: ["devsecops", "sast", "sca", "security-scanner"],
	},
];
