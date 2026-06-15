# Zylabs AI Copilot

An AI Research Copilot that helps users prepare for sales/business meetings by researching a company and generating structured briefings.

## Demo

🎥 **[Watch on YouTube](https://www.youtube.com/watch?v=xTpaBiVbFDo)**

Covers creating a session, live LangGraph workflow progress, generated report, follow-up chat, and sidebar actions (pin, rename, delete).

## Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS (Vanilla styling)
- **Backend:** Python, FastAPI, SQLite (SQLAlchemy)
- **AI/Workflow:** LangGraph, LangChain (OpenAI, DuckDuckGo)

## Setup & Run

### 1. Backend
1. Navigate to the `backend` folder.
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment: `venv\Scripts\activate` (Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file in `backend/` with your API keys:
   ```
   OPENAI_API_KEY=your_key_here
   # Optional: OPENAI_BASE_URL=your_proxy_url
   ```
6. Run the server (pick one):

   ```bash
   uvicorn main:app --reload
   ```

   Or:

   ```bash
   python main.py
   ```

   If port 8000 is busy (`WinError 10013`), use another port:

   ```bash
   set PORT=8001
   python main.py
   ```

   Then start the frontend with a matching proxy target:

   ```bash
   cd ../frontend
   set VITE_API_URL=http://127.0.0.1:8001
   npm run dev
   ```

   The backend will run on `http://127.0.0.1:8000` by default.

### Troubleshooting

**`WinError 10013` / port already in use**

Something else is bound to port 8000 (often a previous `uvicorn` you didn't stop).

```bash
netstat -ano | findstr :8000
taskkill /PID <pid_from_above> /F
```

Or run on a different port: `set PORT=8001` then `python main.py`.

### 2. Frontend
1. Navigate to the `frontend` folder.
2. Install dependencies: `npm install`
3. Start the Vite dev server: `npm run dev`
4. Access the app at `http://localhost:5173`.
