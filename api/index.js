// api/index.js - Servidor adaptado para Vercel
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// Configurar variables de entorno para Vercel
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", SUPABASE_URL || "https://*.supabase.co"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 requests por ventana
});
app.use(limiter);

// Middleware general
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos desde public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas API inline (para evitar problemas de rutas en Vercel)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
);

// API Routes
app.get('/api/supabase/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paises')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    res.json({ 
      status: 'success', 
      message: 'Conexión a Supabase exitosa',
      timestamp: new Date().toISOString(),
      supabaseConnected: true
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Error de conexión a Supabase',
      error: error.message,
      supabaseUrl: SUPABASE_URL ? 'configurado' : 'no configurado'
    });
  }
});

app.get('/api/contenido/paises', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paises')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contenido/destacado', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contenido')
      .select(`
        *,
        paises(nombre, codigo_pais, bandera_emoji),
        categorias_contenido(nombre, icono)
      `)
      .eq('destacado', true)
      .eq('estado', 'publicado')
      .order('fecha_publicacion', { ascending: false })
      .limit(6);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservas', async (req, res) => {
  try {
    const {
      nombre_completo, telefono, email, numero_comensales,
      fecha_reserva, pais_experiencia, ocasion_especial
    } = req.body;
    
    // Validaciones básicas
    if (!nombre_completo || !telefono || !email || !numero_comensales || !fecha_reserva) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios',
        campos_requeridos: ['nombre_completo', 'telefono', 'email', 'numero_comensales', 'fecha_reserva']
      });
    }
    
    // Verificar que la fecha no sea en el pasado
    const fechaReserva = new Date(fecha_reserva);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaReserva < hoy) {
      return res.status(400).json({ 
        error: 'La fecha de reserva no puede ser en el pasado' 
      });
    }
    
    const comensales = parseInt(numero_comensales);
    if (comensales < 1 || comensales > 12) {
      return res.status(400).json({ 
        error: 'El número de comensales debe estar entre 1 y 12' 
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('reservas')
      .insert({
        nombre_completo,
        telefono,
        email,
        numero_comensales: comensales,
        fecha_reserva,
        pais_experiencia,
        ocasion_especial,
        estado: 'pendiente'
      })
      .select();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente. Nos pondremos en contacto contigo pronto.',
      reserva: data[0]
    });
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

app.post('/api/reservas/newsletter', async (req, res) => {
  try {
    const { email, nombre } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email es requerido' 
      });
    }
    
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('suscriptores')
      .upsert(
        { email, nombre, activo: true }, 
        { onConflict: 'email' }
      )
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Suscripción exitosa al newsletter',
      suscriptor: data[0]
    });
  } catch (error) {
    console.error('Error en suscripción:', error);
    res.status(500).json({ 
      error: 'Error al procesar suscripción',
      message: error.message 
    });
  }
});

// Ruta principal - servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    supabase: SUPABASE_URL ? 'configured' : 'not configured'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Algo salió mal!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Para Vercel
module.exports = app;

// Para desarrollo local
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}