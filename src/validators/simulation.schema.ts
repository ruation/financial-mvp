import { z } from 'zod';

const cleanDigits = (value: string) => value.replace(/\D/g, '');
const isAllSameDigit = (value: string) => /^(\d)\1+$/.test(value);

const baseSchema = z.object({
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
    .refine((val) => val.length === 11 && !isAllSameDigit(val), {
      message: 'O CPF deve conter 11 dígitos válidos (não repetidos).',
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

const buildCnpjField = (label: string) =>
  z
    .string({ required_error: `Informe o ${label}.` })
    .transform(cleanDigits)
    .refine((val) => val.length === 14 && !isAllSameDigit(val), {
      message: `O ${label} deve conter 14 dígitos válidos.`,
    });

const cltSchema = baseSchema.extend({
  profile: z.literal('CLT'),
  employerCnpj: buildCnpjField('CNPJ do empregador'),
});

const inssSchema = baseSchema.extend({
  profile: z.literal('INSS'),
  benefitNumber: z
    .string({ required_error: 'Informe o Número do Benefício (NB).' })
    .transform(cleanDigits)
    .refine((val) => val.length === 10 && !isAllSameDigit(val), {
      message: 'O Número do Benefício (NB) deve conter 10 dígitos válidos.',
    }),
});

const publicServantSchema = baseSchema.extend({
  profile: z.literal('PUBLIC_SERVANT'),
  employerCnpj: buildCnpjField('CNPJ do órgão público'),
  registrationNumber: z
    .string({ required_error: 'Informe a matrícula do servidor.' })
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9./-]{3,20}$/,
      'A matrícula deve ter de 3 a 20 caracteres (letras, números, ".", "-" ou "/").'
    ),
});

/**
 * Backward compatibility: payloads without `profile` are treated as CLT,
 * so clients built before the profile step keep working unchanged.
 */
const withDefaultProfile = (input: unknown) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const body = input as Record<string, unknown>;
    if (body.profile === undefined || body.profile === null || body.profile === '') {
      return { ...body, profile: 'CLT' };
    }
  }
  return input;
};

export const simulationSchema = z.preprocess(
  withDefaultProfile,
  z.discriminatedUnion('profile', [cltSchema, inssSchema, publicServantSchema], {
    errorMap: (issue, ctx) =>
      issue.code === 'invalid_union_discriminator'
        ? { message: 'Perfil inválido. Use CLT, INSS ou PUBLIC_SERVANT.' }
        : { message: ctx.defaultError },
  })
);
