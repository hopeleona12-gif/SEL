# SEL Assessment Demo

T03 规则抑制任务的研究型网页测评 Demo。

## 启动后端

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

## 启动前端

```powershell
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173。素材放入 `frontend/public/assets/tasks/T03/`。

## 测试评分器

```powershell
python -m unittest discover -s tests/backend -p "test_*.py"
```
