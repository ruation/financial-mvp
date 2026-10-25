import express from 'express';
import cors from 'cors';
import path from 'path';
import { ZodError } from 'zod';
import { simulationSchema } from './validators/simulation.schema';
import { EmployerService } from './services/employer.service';
import { SimulationService } from './services/simulation.service';
import { BancoAlfaProvider } from './providers/banco-alfa.provider';
import { BancoBetaProvider } from './providers/banco-beta.provider';
import { BancoGamaProvider } from './providers/banco-gama.provider';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const employerService = new EmployerService();
const simulationService = new SimulationService(employerService, [
  new BancoAlfaProvider(),
  new BancoBetaProvider(),
  new BancoGamaProvider(),
]);

app.post('/api/simulations', async (req, res) => {
  try {
    const validatedInput = simulationSchema.parse(req.body);
    const result = await simulationService.executeSimulation(validatedInput);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Erro de validação nos dados informados.',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    console.error('[Server] Erro inesperado:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar a simulação de crédito.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
