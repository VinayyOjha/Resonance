import { TextToSpeechLayout } from "@/feature/text-to-speech/views/text-to-speech-layout";

export default function TTSLayout({children}:{children:React.ReactNode}){
    return(
        <TextToSpeechLayout>
            {children}
        </TextToSpeechLayout>
    )
}