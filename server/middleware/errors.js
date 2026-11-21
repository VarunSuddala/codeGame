export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, status, message) => {
  if (!condition) throw new HttpError(status, message);
};
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === 'ZodError')
    return res.status(400).json({
      message: 'Invalid input',
      errors: error.issues.map((x) => ({ path: x.path.join('.'), message: x.message })),
    });
  if (error.code === 11000)
    return res.status(409).json({ message: 'This record already exists or the answer is locked.' });
  if (error.name === 'ValidationError' || error.name === 'CastError')
    return res.status(400).json({ message: 'Invalid record data.' });
  const status = error.status || 500;
  if (status >= 500) console.error('Request failed:', error.name, error.message);
  res.status(status).json({
    message: status >= 500 ? 'Unable to complete this request. Please retry.' : error.message,
  });
}
