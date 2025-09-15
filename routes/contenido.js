// routes/contenido.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Configuración de multer para archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/', 'audio/'];
    const isValid = allowedTypes.some(type => file.mimetype.startsWith(type));
    cb(null, isValid);
  }
});

// Obtener todos los países
router.get('/paises', async (req, res) => {
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

// Obtener contenido por tipo
router.get('/tipo/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10, pais } = req.query;
    
    let query = supabase
      .from('contenido')
      .select(`
        *,
        paises(nombre, codigo_pais, bandera_emoji),
        categorias_contenido(nombre, icono)
      `)
      .eq('tipo_contenido', tipo)
      .eq('estado', 'publicado')
      .order('fecha_publicacion', { ascending: false });
    
    if (pais) {
      query = query.eq('pais_id', pais);
    }
    
    const { data, error, count } = await query
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw error;
    
    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener contenido destacado
router.get('/destacado', async (req, res) => {
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

// Obtener categorías
router.get('/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias_contenido')
      .select('*')
      .eq('activo', true)
      .order('tipo_contenido, nombre');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar contenido
router.get('/buscar/:termino', async (req, res) => {
  try {
    const { termino } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const { data, error } = await supabase
      .from('contenido')
      .select(`
        *,
        paises(nombre, codigo_pais, bandera_emoji)
      `)
      .eq('estado', 'publicado')
      .or(`titulo.ilike.%${termino}%,descripcion.ilike.%${termino}%`)
      .order('fecha_publicacion', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener contenido por slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const { data, error } = await supabase
      .from('contenido')
      .select(`
        *,
        paises(nombre, codigo_pais, bandera_emoji),
        categorias_contenido(nombre, icono)
      `)
      .eq('slug', slug)
      .eq('estado', 'publicado')
      .single();
    
    if (error) throw error;
    
    // Incrementar vistas
    await supabase
      .from('contenido')
      .update({ vistas: data.vistas + 1 })
      .eq('id', data.id);
    
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Contenido no encontrado' });
  }
});

module.exports = router;