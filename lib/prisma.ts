// Simple Prisma client initialization
// Avoid dynamic imports that cause module resolution issues

const prismaClientModule = async () => {
	const mod = await import('../prisma-client/client')
	return mod
}

let prismaInstance: any = null

export async function getPrismaClient() {
	if (!prismaInstance) {
		try {
			const { PrismaClient } = await prismaClientModule()
			prismaInstance = new PrismaClient({
				log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
			})
		} catch (error) {
			console.error('Failed to initialize Prisma:', error)
			throw error
		}
	}
	return prismaInstance
}
