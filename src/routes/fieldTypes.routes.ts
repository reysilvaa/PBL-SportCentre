import express from 'express';
import { 
  getFieldTypes, 
  createFieldType, 
  updateFieldType, 
  deleteFieldType 
} from '../controllers/fieldType.controller';

const router = express.Router();

router.get('/', getFieldTypes);
router.post('/', createFieldType);
router.put('/:id', updateFieldType);
router.delete('/:id', deleteFieldType);

export default router;