import express from 'express';
import pg from 'pg';

const app = express();
app.use(express.json());

// Enable CORS so external applications can interface cleanly over the web
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Cloud Database Connection Pool using your credentials directly
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:Tq6zyWzmfuQFnOCb@db.kljclvaqsnooaxoayqnw.supabase.co:5432/postgres"
});

// Direct Web Tool Route matching your cloud payload schema
app.post('/api/save-weekly-schedule', async (req, res) => {
  try {
    const { time_slots } = req.body;
    if (!time_slots || !Array.isArray(time_slots)) {
      return res.status(400).json({ error: "Invalid schedule format" });
    }
    await pool.query("DELETE FROM calendar_tasks");
    for (const slot of time_slots) {
      await pool.query(
        "INSERT INTO calendar_tasks (day, start_time, end_time, title, type, importance) VALUES ($1, $2, $3, $4, $5, $6)",
        [slot.day, slot.start_time, slot.end_time, slot.title, slot.type, slot.importance]
      );
    }
    res.json({ success: true, message: `Scheduled ${time_slots.length} slots successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Fetch schedule for the Frontend Grid Interface
app.get('/api/schedule', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM calendar_tasks ORDER BY day, start_time ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the Aesthetic Minimalist Beige Calendar Dashboard Interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Weekly Outlook &bull; ChronoPlan</title>
      <script src="https://tailwindcss.com"></script>
      <link rel="preconnect" href="https://googleapis.com">
      <link rel="preconnect" href="https://gstatic.com" crossorigin>
      <link href="https://googleapis.com/css2?family=Cinzel:wght@400;600&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f7f4ef; }
        .serif-title { font-family: 'Cinzel', serif; letter-spacing: 0.05em; }
      </style>
    </head>
    <body class="text-stone-700 min-h-screen">
      
      <!-- Pinterest-Aesthetic Top Navigation Header -->
      <nav class="max-w-7xl mx-auto py-8 px-6 flex justify-between items-center border-b border-stone-200/60">
        <div class="flex flex-col">
          <span class="serif-title text-xl font-medium tracking-wider text-stone-800">ChronoPlan</span>
          <span class="text-[11px] text-stone-400 font-medium uppercase tracking-widest mt-0.5">The Weekly Routine Engine</span>
        </div>
        <button onclick="fetchSchedule()" class="px-5 py-2.5 text-xs bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-full transition-all duration-300 font-medium tracking-wider uppercase shadow-xs">
          🔄 Sync Timeline
        </button>
      </nav>

      <!-- Main Layout Body Box -->
      <main class="max-w-7xl mx-auto p-6 mt-4">
        <div class="mb-8">
          <h1 class="serif-title text-2xl font-medium text-stone-800">Weekly Outlook</h1>
          <p class="text-xs text-stone-400 font-medium mt-1">A curated space mapping out your priorities, targets, and breaks balance frames.</p>
        </div>

        <!-- The 5-Day Structural Dashboard Columns Grid -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-6" id="calendar-grid"></div>
      </main>

      <script>
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

        async function fetchSchedule() {
          const res = await fetch('/api/schedule');
          const tasks = await res.json();
          const grid = document.getElementById('calendar-grid');
          grid.innerHTML = '';

          days.forEach(day => {
            const dayTasks = tasks.filter(t => t.day === day);
            let dayHtml = \`
              <div class="bg-white/80 border border-stone-200/50 rounded-2xl p-5 shadow-xs backdrop-blur-xs min-h-[460px] flex flex-col">
                <h3 class="serif-title font-medium text-stone-800 border-b border-stone-100 pb-2 mb-4 text-center tracking-wide text-xs uppercase">\${day}</h3>
                <div class="space-y-3.5 flex-1">
            \`;

            if(dayTasks.length === 0) {
              dayHtml += \`
                <div class="flex flex-col items-center justify-center py-20 text-stone-400">
                  <span class="text-lg">🌿</span>
                  <p class="text-[11px] font-medium tracking-wide mt-2 text-center">Quiet day ahead</p>
                </div>
              \`;
            } else {
              dayTasks.forEach(task => {
                // Pinterest Earthy Soft Tones Architecture Palette Styling
                let bgClass = "bg-stone-50 border-stone-200/60 text-stone-700"; // Tasks: Soft Warm Clay
                if(task.type === 'lunch') bgClass = "bg-[#ebdccb] border-[#decbb7] text-stone-800 font-medium"; // Lunch: Toasted Oatmeal Cream
                if(task.type === 'break') bgClass = "bg-[#dbe1d9] border-[#cbd3c7] text-stone-700 text-[11px] text-center italic tracking-wide"; // Breaks: Muted Sage Leaf Green
                if(task.type === 'buffer') bgClass = "bg-stone-50 border-stone-300 border-dashed text-stone-500"; // Buffer Blocks: Soft Flax Linen
                if(task.importance === 'v imp') bgClass = "bg-[#d4b0a2]/50 border-[#c49b88] text-stone-900 font-semibold ring-1 ring-[#decbb7]"; // Very Important: Soft Terracotta Rose

                dayHtml += \`
                  <div class="p-3.5 border rounded-xl transition-all duration-300 shadow-2xs hover:shadow-xs \${bgClass}">
                    <div class="font-mono text-[10px] text-stone-400 mb-1 flex items-center space-x-1 font-medium">
                      <span>\${task.start_time}</span>
                      <span class="opacity-60">-</span>
                      <span>\${task.end_time}</span>
                    </div>
                    <div class="text-xs leading-relaxed font-medium tracking-wide text-stone-800">\${task.title}</div>
                  </div>
                \`;
              });
            }

            dayHtml += \`</div></div>\`;
            grid.innerHTML += dayHtml;
          });
        }

        window.onload = fetchSchedule;
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`Aesthetic web server online on port ${PORT}`));
