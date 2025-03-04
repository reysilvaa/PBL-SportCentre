import express from 'express';
import { ApiDocumentationController } from './api.documentation.controller';

const router = express.Router();

router.get('/', ApiDocumentationController.generateDocumentation);

export default router;