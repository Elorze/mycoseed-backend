import { Router } from 'express'
import {
    getAllTasks,
    getTaskById,
    createTask,
    claimTask,
    submitProof
} from '../controllers/tasksController'

const router = Router()

router.get('/', getAllTasks)
router.get('/:id', getTaskById)
router.post('/', createTask)
router.patch('/:id/claim', claimTask)
router.patch('/:id/submit', submitProof)

export default router