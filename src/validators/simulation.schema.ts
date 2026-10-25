import { z } from 'zod';

const cleanDigits = (value: string) => value.replace(/\D/g, '');

export const simulationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Formato de e-mail inválido.'),
  cpf: z
    .string()
    .transform(cleanDigits)
    .refine((val) => val.length === 11 && !/^(\d)\1+$/.test(val), {
      message: 'O CPF deve conter 11 dígitos válidos (não repetidos).',
    }),
  employerCnpj: z
    .string()
    .transform(cleanDigits)
    .refine((val) => val.length === 14 && !/^(\d)\1+$/.test(val), {
      message: 'O CNPJ do empregador deve conter 14 dígitos válidos.',
    }),
  monthlyIncome: z.coerce
    .number()
    .positive('O salário deve ser maior que zero.')
    .min(1412, 'O salário mínimo para simulação é de R$ 1.412,00.'),
  requestedAmount: z.coerce
    .number()
    .min(1000, 'O valor mínimo para empréstimo consignado é de R$ 1.000,00.'),
  installments: z.coerce
    .number()
    .int('A quantidade de parcelas deve ser um número inteiro.')
    .min(6, 'O prazo mínimo é de 6 parcelas.')
    .max(84, 'O prazo máximo permitido é de 84 parcelas.'),
});
