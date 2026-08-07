import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, setLogLevel, terminate } from "firebase/firestore";

const DB_FILE = "/tmp/biz_suite_db.json";
const FIRESTORE_DISABLED_FILE = "/tmp/firestore_disabled";

// In-memory cache of the database state
let databaseState: Record<string, any> = {};
let isFirestoreDisabled = fs.existsSync(FIRESTORE_DISABLED_FILE);

// Initialize Firebase SDK
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);

let db: any = null;
function getFirestoreDb() {
  if (isFirestoreDisabled) return null;
  if (!db) {
    try {
      console.log("Initializing Firebase Firestore client lazily...");
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
      try {
        setLogLevel("error");
      } catch (e) {}
    } catch (e: any) {
      console.error("Failed to initialize Firestore, shutting down DB sync:", e);
      isFirestoreDisabled = true;
      try {
        fs.writeFileSync(FIRESTORE_DISABLED_FILE, "true", "utf-8");
      } catch (writeErr) {}
      return null;
    }
  }
  return db;
}

async function disableFirestoreAndClose() {
  isFirestoreDisabled = true;
  try {
    fs.writeFileSync(FIRESTORE_DISABLED_FILE, "true", "utf-8");
  } catch (e) {}
  if (db) {
    try {
      console.log("Terminating Firestore connection to prevent retry loop flood...");
      await terminate(db).catch(() => {});
    } catch (err) {
      console.error("Error terminating Firestore:", err);
    }
    db = null;
  }
}

// Lazy-initialization of the GoogleGenAI client (to prevent startup failure if key is missing)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Function to extract structured real-time tenant context for AI grounding
function getTenantContext(tenantId: string) {
  const tenants = databaseState["biz_suite_tenants"] || [];
  const tenant = tenants.find((t: any) => t.id === tenantId);
  const companyName = tenant?.companyName || "Our Enterprise";
  const currency = tenant?.currency || "USD";
  
  const customers = (databaseState["biz_suite_customers"] || []).filter((c: any) => c.tenantId === tenantId);
  const products = (databaseState["biz_suite_products"] || []).filter((p: any) => p.tenantId === tenantId);
  const sales = (databaseState["biz_suite_sales"] || []).filter((s: any) => s.tenantId === tenantId);
  const expenses = (databaseState["biz_suite_expenses"] || []).filter((e: any) => e.tenantId === tenantId);
  const invoices = (databaseState["biz_suite_invoices"] || []).filter((inv: any) => inv.tenantId === tenantId);

  // Simple stats
  const totalSales = sales.reduce((sum: number, s: any) => sum + s.amount, 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  const lowStockCount = products.filter((p: any) => p.stock <= p.minStockAlert).length;

  return {
    companyName,
    currency,
    totalSales,
    totalExpenses,
    profit,
    customerCount: customers.length,
    lowStockCount,
    customers: customers.map((c: any) => ({ id: c.id, name: c.name, email: c.email })),
    products: products.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock, minStockAlert: p.minStockAlert })),
    sales: sales.slice(-15).map((s: any) => ({ date: s.date, amount: s.amount, category: s.category, customerName: s.customerName, description: s.description })),
    expenses: expenses.slice(-15).map((e: any) => ({ date: e.date, amount: e.amount, category: e.category, recipient: e.recipient, description: e.description })),
    invoices: invoices.slice(-15).map((inv: any) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, total: inv.total, status: inv.status, date: inv.date, dueDate: inv.dueDate }))
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Load database state from Firestore on startup
  let stateLoaded = false;
  if (!isFirestoreDisabled) {
    try {
      console.log("Loading Omni-Suite state from Firebase Firestore...");
      const firestoreDb = getFirestoreDb();
      if (!firestoreDb) {
        throw new Error("Firestore is disabled or could not be initialized.");
      }
      const keys = [
        "biz_suite_tenants",
        "biz_suite_customers",
        "biz_suite_products",
        "biz_suite_invoices",
        "biz_suite_sales",
        "biz_suite_expenses",
        "biz_suite_access_logs",
        "biz_suite_support_chats",
        "biz_suite_active_sessions",
        "biz_suite_purchases"
      ];
      for (const key of keys) {
        const docRef = doc(firestoreDb, "app_state", key);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          databaseState[key] = docSnap.data().data || [];
        } else {
          databaseState[key] = [];
        }
      }
      console.log(`Successfully loaded ${keys.length} keys from Firebase Firestore.`);
      stateLoaded = true;
    } catch (error) {
      console.error("Error loading database state from Firestore, falling back to local file:", error);
      const errStr = String(error);
      if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota") || errStr.includes("quota") || errStr.includes("resource-exhausted")) {
        console.warn("Firestore Quota exceeded on startup. Disabling cloud sync to run in High-Performance Local-Disk backup mode.");
        await disableFirestoreAndClose();
      }
    }
  }

  if (!stateLoaded) {
    try {
      if (fs.existsSync(DB_FILE)) {
        databaseState = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
        console.log("Loaded backup state from:", DB_FILE);
      }
    } catch (e) {
      console.error("Failed to read local backup file:", e);
    }
  }

  // API endpoints FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", persistenceFile: DB_FILE, firebaseProjectId: firebaseConfig.projectId, isFirestoreDisabled });
  });

  // Fetch complete database state
  app.get("/api/db", (req, res) => {
    res.json(databaseState);
  });

  // Save/Sync database state
  app.post("/api/db", async (req, res) => {
    try {
      const incomingState = req.body || {};
      const isCallerAdmin = req.headers["x-caller-role"] === "admin";
      
      const keysToMerge = [
        "biz_suite_tenants",
        "biz_suite_customers",
        "biz_suite_products",
        "biz_suite_invoices",
        "biz_suite_sales",
        "biz_suite_expenses",
        "biz_suite_access_logs",
        "biz_suite_support_chats",
        "biz_suite_active_sessions",
        "biz_suite_purchases"
      ];

      let anyChange = false;
      const changedKeys: string[] = [];

      for (const key of keysToMerge) {
        const existingArray = databaseState[key] || [];
        const incomingArray = incomingState[key] || [];

        if (!Array.isArray(incomingArray)) {
          continue;
        }

        if (existingArray.length === 0 && incomingArray.length > 0) {
          databaseState[key] = incomingArray;
          anyChange = true;
          changedKeys.push(key);
          continue;
        }

        // Merge array records based on unique ID field to avoid deletion / overwrite of concurrent data
        const mergedMap = new Map();
        
        existingArray.forEach((item: any) => {
          if (item) {
            const itemId = item.id || (item.userId ? `${item.userId}-${item.email}` : null);
            if (itemId) {
              mergedMap.set(itemId, item);
            }
          }
        });

        incomingArray.forEach((item: any) => {
          if (item) {
            const itemId = item.id || (item.userId ? `${item.userId}-${item.email}` : null);
            if (itemId) {
              const existing = mergedMap.get(itemId);
              if (existing) {
                let mergedItem = { ...existing, ...item };
                
                // Keep administration status and policies secure: blocked tenants / customers cannot self-unblock
                if (!isCallerAdmin) {
                  if (key === "biz_suite_tenants") {
                    if (existing.isActive === false && item.isActive === true) {
                      mergedItem.isActive = false;
                    }
                    if (existing.subscriptionStatus === "locked" && item.subscriptionStatus !== "locked") {
                      mergedItem.subscriptionStatus = "locked";
                    }
                  }
                  if (key === "biz_suite_customers") {
                    if (existing.isBlocked === true && item.isBlocked === false) {
                      mergedItem.isBlocked = true;
                    }
                  }
                }

                mergedMap.set(itemId, mergedItem);
              } else {
                mergedMap.set(itemId, item);
              }
            }
          }
        });

        const mergedArray = Array.from(mergedMap.values());
        
        // Count string divergence to see if values actually diverged
        const existingStr = JSON.stringify(existingArray);
        const mergedStr = JSON.stringify(mergedArray);
        
        if (existingStr !== mergedStr) {
          databaseState[key] = mergedArray;
          anyChange = true;
          changedKeys.push(key);
        }
      }

      // Check for custom auxiliary keys not in the standard merge array
      Object.keys(incomingState).forEach(key => {
        if (!keysToMerge.includes(key)) {
          if (JSON.stringify(databaseState[key]) !== JSON.stringify(incomingState[key])) {
            databaseState[key] = incomingState[key];
            anyChange = true;
            changedKeys.push(key);
          }
        }
      });

      // Write changes to container filesystem backup only if true modifications occurred
      if (anyChange) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(databaseState, null, 2), "utf-8");
      }
      
      // Attempt to save to cloud Firestore with a try-catch wrapper to remain perfectly resilient to free quota exhaustion errors
      let firebaseError: string | null = null;
      if (!isFirestoreDisabled) {
        try {
          // Direct sync of all active state layers with Firestore
          const writableFirebaseKeys = changedKeys;
          
          if (writableFirebaseKeys.length > 0) {
            console.log(`Saving updated keys [${writableFirebaseKeys.join(", ")}] to Firebase Firestore...`);
            const firestoreDb = getFirestoreDb();
            if (!firestoreDb) {
              throw new Error("Firestore is disabled or failed to initialize.");
            }
            
            for (const key of writableFirebaseKeys) {
              if (databaseState[key] !== undefined) {
                const docRef = doc(firestoreDb, "app_state", key);
                await setDoc(docRef, { data: databaseState[key] });
              }
            }
          }
        } catch (fbErr: any) {
          firebaseError = fbErr.message || String(fbErr);
          console.warn("Firestore save failed (Quota Exceeded or Resource Exhausted). Operating on container disk backup gracefully:", firebaseError);
          if (firebaseError.includes("RESOURCE_EXHAUSTED") || firebaseError.includes("Quota") || firebaseError.includes("quota") || fbErr.code === "resource-exhausted") {
            console.warn("Quota limit detected. Activating offline-mode fallback to suppress future stream sockets or log spams.");
            await disableFirestoreAndClose();
          }
        }
      } else {
        // Occasionally try to reconnect to Firestore if files exist, but keep console clean
      }
      
      res.json({ 
        success: true, 
        firebaseSynced: firebaseError === null && !isFirestoreDisabled,
        firebaseError: firebaseError || undefined,
        timestamp: new Date().toISOString() 
      });
    } catch (error: any) {
      console.error("Critical disk persistence failure inside container storage:", error);
      res.status(500).json({ error: error.message || "Persistence failure" });
    }
  });

  // Secure and ground AI query chat endpoint using gemini-3.5-flash
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, tenantId } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (!tenantId) {
        return res.status(400).json({ error: "TenantId is required" });
      }

      // Check key and load client
      const client = getGeminiClient();

      // Retrieve contextual merchant metadata
      const context = getTenantContext(tenantId);

      // System prompt grounding instructions
      const systemInstruction = `You are OmniAI, a powerful embedded AI Financial Officer and Business Consultant for OmniSuite ERP.
You have a direct, secured view of the merchant's business records.
Your objective is to provide professional, actionable financial analysis, invoice summaries, stock checks, and business guidance.

Current isolated business records for ${context.companyName} (Tenant ID: ${tenantId}):
- Default Currency: ${context.currency}
- Total Recorded Sales (Revenue): ${context.currency} ${context.totalSales}
- Total Recorded Expenses: ${context.currency} ${context.totalExpenses}
- Net Profit: ${context.currency} ${context.profit}
- Active Customers: ${context.customerCount}
- Products with Critical/Low Stock: ${context.lowStockCount}

Detailed product list (to reference specific catalog items, codes, stock levels):
${JSON.stringify(context.products, null, 2)}

Recent sales (up to 15 transactions):
${JSON.stringify(context.sales, null, 2)}

Recent expenses (up to 15 logs):
${JSON.stringify(context.expenses, null, 2)}

Invoices (up to 15 sheets):
${JSON.stringify(context.invoices, null, 2)}

Instructions:
- Analyze metrics directly when asked (e.g. calculate margins, identify top products, evaluate cash flows, identify the date of any entry).
- Format your response with beautiful, polished Markdown (use bold text, highlights, lists, and clean alignment).
- Maintain a highly helpful, intelligent, polite, and executive-level tone.
- Do NOT explicitly mention that you were supplied with raw JSON data. Keep it natural: "I have examined your products list, and..."
- Keep replies concise, scannable, and focused on helping the business owner optimize operations.

Special Feature: WhatsApp Action Integrations
- When a user asks you to send or draft a WhatsApp reminder for a customer's outstanding dues/invoices, you must output a professional reminder draft.
- AND, you must supply a special action tag at the bottom or inline, so the UI can render a brilliant green clickable button to let the merchant send the WhatsApp message immediately in real time.
- The special tag format is: [WA_ACTION:phone_number:message_url_encoded:Button Label]
- IMPORTANT: Replace phone_number with the customer's actual phone number (strip spaces/dashes), message_url_encoded with standard URL-encoded reminder text, and Button Label with a description like "📲 Send WhatsApp Reminder to [Customer Name]".
- Example: [WA_ACTION:971123456:Hello%20John%2C%20this%20is%20a%20reminder%20for%20Invoice%20%23INV-1%20of%20AED%20500:📲 Send WhatsApp Reminder to John]`;

      // Format clean history for Gemini SDK
      const contents = [];
      
      if (history && Array.isArray(history)) {
        for (const item of history) {
          if (item.role && item.text) {
            contents.push({
              role: item.role === "user" ? "user" : "model",
              parts: [{ text: item.text }]
            });
          }
        }
      }

      // Finally append the active prompt
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      // Call Gemini 3.5 Flash
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error("Gemini API Error in /api/ai/chat:", error);
      res.status(500).json({ error: error.message || "AI service connection failure" });
    }
  });

  // Vite middleware for assets serving in development and production routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
