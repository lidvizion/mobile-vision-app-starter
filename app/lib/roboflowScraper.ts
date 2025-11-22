// Dynamic imports for puppeteer to avoid Next.js build issues
// These will be imported at runtime only

// Define types for our model data
export interface RoboflowModel {
    project_title: string;
    url: string;
    author: string;
    project_type: string;
    has_model: boolean;
    updated: string;
    mAP: string | null;
    precision: string | null;
    recall: string | null;
    training_images: string | null;
    tags: string[];
    classes: string[];
    class_count: string;
    api_endpoint: string | null;
    model_identifier: string;
}

const BASE_URL = "https://universe.roboflow.com";
const SCREEN = { width: 1440, height: 900 };

/**
 * Clean text helper
 */
function cleanText(text: string | null | undefined): string {
    if (!text || text === "N/A") return "N/A";
    let cleaned = text.replace(/\s+/g, ' ').trim();
    const noise = ["Go to Roboflow App", "Universe Home", "Sign In or Sign Up",
        "Roboflow App", "Documentation", "Universe", "Back"];
    noise.forEach(n => {
        cleaned = cleaned.replace(n, "");
    });
    return cleaned.trim() || "N/A";
}

/**
 * Extract first number from text (handles k/K notation)
 */
function extractNumber(text: string | null | undefined): string | null {
    if (!text || text === "N/A") return null;

    const matchK = text.match(/(\d+\.?\d*)\s*[kK]/);
    if (matchK) {
        return String(Math.floor(parseFloat(matchK[1]) * 1000));
    }

    const match = text.match(/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Extract API endpoint from page content
 */
/**
 * Extract API endpoint from page content - IMPROVED
 */
function extractApiEndpoint(html: string, text: string, url: string = ""): string | null {
    // Strategy 1: Look in JavaScript code blocks
    const jsPatterns = [
        /url:\s*["']https:\/\/serverless\.roboflow\.com\/([^"'\?\s]+)["']/,
        /"https:\/\/serverless\.roboflow\.com\/([^"'\?\s]+)"/,
        /https:\/\/serverless\.roboflow\.com\/([a-z0-9\-_]+\/\d+)/,
    ];

    for (const pattern of jsPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            if (match[1].includes('/')) {
                return `https://serverless.roboflow.com/${match[1]}`;
            }
        }
    }

    // Strategy 2: Look for model_id in code
    const modelIdPatterns = [
        /model_id["']?\s*[:=]\s*["']([a-z0-9\-_]+\/\d+)["']/i,
        /MODEL_ENDPOINT["']?\s*[:=]\s*["']([a-z0-9\-_]+\/\d+)["']/i,
        /PROJECT_ID["']?\s*[:=]\s*["']([a-z0-9\-_]+)["']/i,
    ];

    for (const pattern of modelIdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return `https://serverless.roboflow.com/${match[1]}`;
        }
    }

    // Strategy 3: Check visible page text
    const serverlessMatch = text.match(/https:\/\/serverless\.roboflow\.com\/([a-z0-9\-_]+\/\d+)/);
    if (serverlessMatch) {
        return serverlessMatch[0];
    }

    // Strategy 4: Legacy endpoint fallback
    const legacyPatterns = [
        /https:\/\/detect\.roboflow\.com\/([a-z0-9\-_]+\/\d+)/,
        /https:\/\/classify\.roboflow\.com\/([a-z0-9\-_]+\/\d+)/,
        /https:\/\/outline\.roboflow\.com\/([a-z0-9\-_]+\/\d+)/,
        /https:\/\/segment\.roboflow\.com\/([a-z0-9\-_]+\/\d+)/,
    ];

    for (const pattern of legacyPatterns) {
        const match = html.match(pattern);
        if (match && match[0]) {
            return match[0];
        }
    }

    // Strategy 5: Construct from URL structure if on a model page
    try {
        if (url.includes('/model/')) {
            const parts = url.split('/');
            const modelIdx = parts.indexOf('model');
            if (modelIdx >= 2) {
                const project = parts[modelIdx - 1];
                const version = parts[modelIdx + 1];
                if (version && /^\d+$/.test(version)) {
                    return `https://serverless.roboflow.com/${project}/${version}`;
                }
            }
        }
    } catch (e) { }

    return null;
}

/**
 * Extract details from a single model page
 */
async function extractModelDetails(page: any, url: string): Promise<RoboflowModel | null> {
    try {
        console.log(`   📄 Extracting from: ${url}`);
        const baseUrl = url.split('/model/')[0];

        // Navigate to model page if possible
        if (!page.url().includes('/model/')) {
            try {
                // Try to find a link to the model page or API docs
                const modelSelectors = [
                    "a[href*='/model/']",
                    "//a[contains(text(), 'Model')]",
                    "//button[contains(text(), 'Model')]",
                    "//a[contains(text(), 'API Docs')]"
                ];

                let clicked = false;
                for (const selector of modelSelectors) {
                    try {
                        const element = selector.startsWith('//')
                            ? (await page.$x(selector))[0]
                            : await page.$(selector);

                        if (element) {
                            console.log(`   🔗 Clicking to find API endpoint...`);
                            await element.click();
                            await new Promise(r => setTimeout(r, 2500));
                            clicked = true;
                            break;
                        }
                    } catch (e) { }
                }

                if (!clicked) {
                    // Try to construct model URL manually
                    const pageText = await page.evaluate(() => document.body.innerText);
                    const versionMatch = pageText.match(/Version\s+(\d+)|Model\s+(\d+)/);
                    if (versionMatch) {
                        const version = versionMatch[1] || versionMatch[2];
                        const modelUrl = `${baseUrl}/model/${version}`;
                        console.log(`   🔗 Navigating to: ${modelUrl}`);
                        await page.goto(modelUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            } catch (e) {
                // Ignore navigation errors
            }
        }

        // Scroll to load content
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(r => setTimeout(r, 1000));

        let content = await page.content();
        let bodyText = await page.evaluate(() => document.body.innerText);

        // Extract API Endpoint
        let apiEndpoint = extractApiEndpoint(content, bodyText, page.url());

        // If not found, try clicking tabs (JS, Python, cURL)
        if (!apiEndpoint) {
            const tabSelectors = [
                "button:has-text('Javascript')",
                "button:has-text('JavaScript')",
                "button:has-text('Python')",
                "button:has-text('cURL')"
            ];

            for (const selector of tabSelectors) {
                try {
                    const [button] = await page.$x(`//button[contains(., '${selector.replace("button:has-text('", "").replace("')", "")}')]`);
                    if (button) {
                        await button.click();
                        await new Promise(r => setTimeout(r, 1000));
                        content = await page.content();
                        bodyText = await page.evaluate(() => document.body.innerText);
                        apiEndpoint = extractApiEndpoint(content, bodyText, page.url());
                        if (apiEndpoint) break;
                    }
                } catch (e) { continue; }
            }
        }

        // Clean API endpoint
        if (apiEndpoint && apiEndpoint.includes('?')) {
            apiEndpoint = apiEndpoint.split('?')[0];
        }

        // Navigate back to Overview for other details if needed
        if (page.url() !== baseUrl && !page.url().includes(baseUrl)) {
            try {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await new Promise(r => setTimeout(r, 1500));
            } catch (e) { }
        }

        // Ensure Overview tab
        try {
            const [overviewTab] = await page.$x("//a[contains(text(), 'Overview')]");
            if (overviewTab) {
                await overviewTab.click();
                await new Promise(r => setTimeout(r, 1000));
                bodyText = await page.evaluate(() => document.body.innerText);
            }
        } catch (e) { }

        // Extract Title - try multiple selectors
        let title = "N/A";
        try {
            // Try h1 first
            const titleEl = await page.$("h1");
            if (titleEl) {
                title = cleanText(await page.evaluate((el: any) => el.innerText, titleEl));
            }

            // If title is generic or missing, extract from URL
            if (!title || title === "N/A" || title.toLowerCase().includes("computer vision model")) {
                const urlParts = url.split('/');
                if (urlParts.length >= 5) {
                    // Format: /workspace/project-name
                    const projectName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
                    if (projectName && !projectName.includes('universe.roboflow.com')) {
                        title = projectName.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    }
                }
            }
        } catch (e) {
            console.log('Error extracting title:', e);
        }

        // Extract Author - try multiple selectors
        let author = "N/A";
        try {
            // Try multiple author selectors
            let authorEl = await page.$("a[href*='/profile']");
            if (!authorEl) {
                // Try alternative selector for workspace/user link
                authorEl = await page.$("a[href^='/'][href*='/']:not([href*='/model'])");
            }
            if (!authorEl) {
                // Try finding by text pattern (e.g., "by USERNAME")
                const authorMatch = bodyText.match(/by\s+([A-Z][A-Za-z0-9_-]+)/i);
                if (authorMatch) {
                    author = authorMatch[1];
                }
            }

            if (authorEl && author === "N/A") {
                const authorText = cleanText(await page.evaluate((el: any) => el.innerText, authorEl));
                // Filter out common non-author text
                if (authorText && !authorText.toLowerCase().includes('overview') &&
                    !authorText.toLowerCase().includes('dataset') &&
                    !authorText.toLowerCase().includes('model') &&
                    authorText.length < 50) {
                    author = authorText;
                }
            }

            // Extract from URL if still N/A
            if (author === "N/A") {
                const urlParts = url.split('/');
                if (urlParts.length >= 4) {
                    // Format: /workspace/project
                    const workspace = urlParts[urlParts.length - 2];
                    if (workspace && !workspace.includes('universe.roboflow.com') && workspace !== 'model') {
                        author = workspace;
                    }
                }
            }
        } catch (e) {
            console.log('Error extracting author:', e);
        }

        // Project Type
        let projectType = "N/A";
        if (bodyText.includes("Keypoint Detection")) projectType = "Keypoint Detection";
        else if (bodyText.includes("Instance Segmentation")) projectType = "Instance Segmentation";
        else if (bodyText.includes("Object Detection")) projectType = "Object Detection";
        else if (bodyText.includes("Classification")) projectType = "Image Classification";

        // Metrics
        let mAP = null, precision = null, recall = null;
        const mapMatch = bodyText.match(/mAP@50[^\d]*(\d+\.?\d*)\s*%/);
        if (mapMatch) mAP = `${mapMatch[1]}%`;

        const precMatch = bodyText.match(/Precision[^\d]*(\d+\.?\d*)\s*%/);
        if (precMatch) precision = `${precMatch[1]}%`;

        const recMatch = bodyText.match(/Recall[^\d]*(\d+\.?\d*)\s*%/);
        if (recMatch) recall = `${recMatch[1]}%`;

        // Images
        const imgMatch = bodyText.match(/(\d+\.?\d*[kK]?)\s*images/);
        const trainingImages = imgMatch ? extractNumber(imgMatch[1]) : null;

        // Classes
        const classes: string[] = [];
        let classCount = "0";
        const classMatch = bodyText.match(/CLASSES\s*\((\d+)\)/);
        if (classMatch) {
            classCount = classMatch[1];
            const classSectionIndex = bodyText.indexOf(classMatch[0]);
            if (classSectionIndex !== -1) {
                const classSection = bodyText.substring(classSectionIndex, classSectionIndex + 500);
                const words = classSection.match(/\b([a-z][a-z0-9_\-]{2,20})\b/g) || [];
                const noise = new Set(['classes', 'tags', 'download', 'dataset', 'model', 'the', 'and', 'with', 'for']);
                for (const w of words) {
                    if (!noise.has(w) && classes.length < 10) {
                        classes.push(w);
                    }
                }
            }
        }

        // Tags
        const tags = [projectType];
        const modelTypes = bodyText.match(/(yolov\d+|yolo|efficientdet|faster-?rcnn|ssd|retinanet)/gi);
        if (modelTypes) {
            modelTypes.slice(0, 3).forEach((m: string) => tags.push(m.toLowerCase()));
        }

        // Model Identifier
        const urlParts = url.split('/');
        let workspace = "N/A", project = "N/A";
        if (url.includes('universe.roboflow.com')) {
            const pathParts = url.split('universe.roboflow.com')[1].split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                workspace = pathParts[0];
                project = pathParts[1];
            }
        }
        const modelIdentifier = (workspace !== "N/A" && project !== "N/A") ? `${workspace}/${project}` : "N/A";

        return {
            project_title: title,
            url: url,
            author,
            project_type: projectType,
            has_model: apiEndpoint !== null || bodyText.toLowerCase().includes('trained model'),
            updated: "N/A", // Simplified
            mAP,
            precision,
            recall,
            training_images: trainingImages,
            tags,
            classes,
            class_count: classCount,
            api_endpoint: apiEndpoint,
            model_identifier: modelIdentifier
        };

    } catch (error) {
        console.error(`Error extracting details from ${url}:`, error);
        return null;
    }
}

/**
 * Main search function
 */
export async function searchRoboflowModelsNode(keywords: string, maxProjects: number = 6): Promise<RoboflowModel[]> {
    let browser = null;
    try {
        console.log(`🚀 Starting Node.js Roboflow Scraper for: "${keywords}"`);

        // Dynamic imports to avoid Next.js build issues
        const puppeteer = (await import('puppeteer-core')).default;
        const chromium = (await import('@sparticuz/chromium')).default;

        // Configure browser launch options for Lambda vs Local
        const isLambda = process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL || process.env.AMPLIFY_MONOREPO_APP_ROOT;

        let launchOptions: any = {
            args: (chromium as any).args,
            defaultViewport: (chromium as any).defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: (chromium as any).headless,
        };

        // If running locally (not in Lambda/Amplify), use local puppeteer
        if (!isLambda) {
            // Try to find local chrome or use puppeteer's bundled one if available
            // For local dev, we might need to adjust this if @sparticuz/chromium doesn't work locally
            // But typically we can just use standard puppeteer launch if we installed 'puppeteer'
            try {
                const localPuppeteer = await import('puppeteer');
                launchOptions = {
                    headless: "new",
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-features=IsolateOrigins,site-per-process',
                    ]
                };
                browser = await localPuppeteer.default.launch(launchOptions);
            } catch (e) {
                console.log("Local puppeteer not found, trying core with chromium path...");
                launchOptions.args = [
                    ...(launchOptions.args || []),
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                ];
                browser = await puppeteer.launch(launchOptions);
            }
        } else {
            // Add anti-detection args for Lambda too
            launchOptions.args = [
                ...(launchOptions.args || []),
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
            ];
            browser = await puppeteer.launch(launchOptions);
        }

        if (!browser) throw new Error("Failed to launch browser");

        const page = await browser.newPage();

        // Set a realistic User-Agent to bypass Cloudflare
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Pass webdriver check
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Construct search URL
        // We use the same logic as the Python script to prioritize keywords
        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(keywords)}`;
        console.log(`🔗 Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 5000));

        // Apply "Has a Model" filter
        try {
            console.log("🔘 Applying 'Has a Model' filter...");
            const hasModelSelectors = [
                "//button[contains(., 'Has a Model')]",
                "//label[contains(., 'Has a Model')]",
                "input[type='checkbox'][value*='model']"
            ];

            for (const selector of hasModelSelectors) {
                try {
                    const element = selector.startsWith('//')
                        ? (await (page as any).$x(selector))[0]
                        : await page.$(selector);

                    if (element) {
                        await element.click();
                        await new Promise(r => setTimeout(r, 3000));
                        console.log("   ✓ Filter applied");
                        break;
                    }
                } catch (e) { }
            }
        } catch (e) {
            console.log("   ⚠️ Could not apply filter:", e);
        }

        // Wait for results
        try {
            await page.waitForSelector("[class*='project'], a[href*='/']", { timeout: 10000 });
        } catch (e) {
            console.log("Timeout waiting for selectors, continuing...");
        }

        // Scroll a bit
        await (page as any).evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await new Promise(r => setTimeout(r, 1000));

        // Extract Project URLs
        const projectUrls = await (page as any).evaluate((baseUrl: any) => {
            const links = Array.from(document.querySelectorAll("a[href]"));
            const urls = new Set<string>();

            for (const link of links) {
                const href = link.getAttribute("href");
                if (!href) continue;

                // Check if it looks like a project URL (workspace/project)
                // Exclude common non-project paths
                if (href.startsWith('/') && href.split('/').length === 3) {
                    const parts = href.split('/');
                    if (['search', 'browse', 'docs', 'api', 'login', 'signup'].includes(parts[1])) continue;
                    urls.add(`${baseUrl}${href}`);
                } else if (href.includes('universe.roboflow.com') && !href.includes('/search')) {
                    urls.add(href);
                }
            }
            return Array.from(urls);
        }, BASE_URL);

        console.log(`🔹 Found ${projectUrls.length} potential projects`);

        if (projectUrls.length === 0) {
            console.log("⚠️ No projects found. Debug HTML available in logs.");
            // In Lambda/Amplify, filesystem is read-only except /tmp
            // Skip file writing to avoid errors, just log for debugging
            if (process.env.NODE_ENV === 'development') {
                try {
                    const html = await page.content();
                    const fs = await import('fs');
                    fs.writeFileSync('/tmp/debug_roboflow.html', html);
                    console.log("📝 Debug HTML saved to /tmp/debug_roboflow.html");
                } catch (e) {
                    console.log("⚠️ Could not write debug file:", e);
                }
            }
        }

        const targetUrls = projectUrls.slice(0, maxProjects);

        const results: RoboflowModel[] = [];

        // Process each project
        for (const url of targetUrls) {
            const details = await extractModelDetails(page, url);
            if (details) {
                results.push(details);
            }
        }

        console.log(`✅ Extracted ${results.length} models`);
        return results;

    } catch (error) {
        console.error("❌ Scraper failed:", error);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
