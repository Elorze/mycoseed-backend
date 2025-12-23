import {Router} from 'express'
import
{
    sendSMSController,
    signInController,
    getMeController,
    setEncryptedKeysController,
    updateProfileController,
} from '../controllers/authController'
import {authenticate} from '../middleware/auth'

const router = Router()

router.post('/send-sms',sendSMSController)
router.post('/signin',signInController)
router.get('/me',authenticate,getMeController)
router.post('/set-encrypted-keys',authenticate,setEncryptedKeysController)
router.patch('/me', authenticate, updateProfileController)

export default router
