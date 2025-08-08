import { Request, Response } from 'express';
import axios from 'axios';

// GET /indicators/uf
export const getUfRate = async (_req: Request, res: Response) => {
  try {
    // Usamos la API pública de Mindicador.cl
    const { data } = await axios.get('https://mindicador.cl/api/uf');
    // El array "serie" viene ordenado de más reciente a más antiguo:
    const ufValue: number = data.serie[0].valor;
    res.json({ ufRate: ufValue });
  } catch (err: any) {
    console.error('Error fetching UF rate:', err.message);
    res.status(500).json({ error: 'No se pudo obtener la tasa UF' });
  }
};
