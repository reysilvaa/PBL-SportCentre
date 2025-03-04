import express from 'express';
import { 
  getFields, 
  createField, 
  updateField, 
  deleteField 
} from '../controllers/field.controller';

const router = express.Router();

router.get('/', getFields);
router.post('/', createField);
router.put('/:id', updateField);
router.delete('/:id', deleteField);

export default router;