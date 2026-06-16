import { prisma } from '@/lib/db';

export default async function TestPage(){
    const voices = await prisma.voice.findMany()

    return (
        <div className="bg-amber-300 p-4 m-4 rounded-lg">
            <h1 className='text-2xl mb-4 font-black'>
                Voices { voices.length }
            </h1>

            { voices.map((voice) => (
                <div key={voice.id} className="">
                    {voice.name} - {voice.variant}
                </div>
            ))}
        </div>
    )
}