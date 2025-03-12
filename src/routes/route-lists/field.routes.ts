import express from 'express';
import { 
  getFields, 
  createField, 
  updateField, 
  deleteField 
} from '../../controllers/all/field.controller';
import { parseIds } from '../../middlewares/parseId.middleware';

const router = express.Router();

router.get('/', getFields);
router.post('/', parseIds, createField);
router.put('/:id', parseIds, updateField);
router.delete('/:id', deleteField);

export default router;