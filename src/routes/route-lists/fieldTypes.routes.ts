import express from 'express';
import { 
  getFieldTypes, 
  createFieldType, 
  updateFieldType, 
  deleteFieldType 
} from '../../controllers/all/fieldType.controller';
import { parseIds } from '../../middlewares/parseId.middleware';

const router = express.Router();

router.get('/', getFieldTypes);
router.post('/', parseIds, createFieldType);
router.put('/:id', updateFieldType);
router.delete('/:id', deleteFieldType);

export default router;