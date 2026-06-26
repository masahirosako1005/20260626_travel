const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'src/public')));

const userRoutes = require('./src/routes/userRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'src/public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'src/public/admin.html')));

app.listen(PORT, () => {
  console.log(`旅のつづき サーバー起動中: http://localhost:${PORT}`);
  console.log(`管理画面: http://localhost:${PORT}/admin`);
});
