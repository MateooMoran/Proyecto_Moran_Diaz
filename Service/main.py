from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb
import uuid
import motor.motor_asyncio
from bson import ObjectId

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB config
MONGO_URI = "mongodb://localhost:27017"
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client.IA
coleccion = db.conversacions

# Embeddings
model = SentenceTransformer("all-MiniLM-L6-v2")
chroma_client = chromadb.PersistentClient(path="./chroma_data")
collection = chroma_client.get_or_create_collection(name="esfot_bot")

# Modelos
class Mensaje(BaseModel):
    rol: str
    contenido: str

# Obtener conversaciones
@app.get("/conversaciones")
async def obtener_conversaciones():
    conversaciones = []
    async for conv in coleccion.find({}, {"titulo": 1, "mensajes": 1}):
        conv["_id"] = str(conv["_id"])
        conversaciones.append(conv)
    return conversaciones

# Nueva conversación
@app.post("/conversaciones/nuevo")
async def nueva_conversacion(primerMensaje: str = Body(..., embed=True)):
    nueva = {
        "titulo": primerMensaje[:30],
        "mensajes": [{"rol": "Estudiante", "contenido": primerMensaje}]
    }
    resultado = await coleccion.insert_one(nueva)
    nueva["_id"] = str(resultado.inserted_id)
    return {"conversacion": nueva}

# Agregar mensaje a una conversación
@app.post("/conversaciones/{conv_id}/mensajes")
async def agregar_mensaje(conv_id: str, mensaje: Mensaje):
    res = await coleccion.update_one(
        {"_id": ObjectId(conv_id)},
        {"$push": {"mensajes": mensaje.dict()}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"message": "Mensaje guardado"}

# Eliminar conversación
@app.delete("/conversaciones/{conv_id}")
async def eliminar_conversacion(conv_id: str):
    res = await coleccion.delete_one({"_id": ObjectId(conv_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"message": "Conversación eliminada"}

# Buscar pregunta similar
@app.post("/buscar")
def buscar_similar(query: str = Body(..., embed=True)):
    query_embedding = model.encode(query).tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=1, include=["distances", "documents"])

    if not results["documents"] or not results["documents"][0]:
        return {
            "respuesta": "Eso no lo entiendo aún 😅. ¿Qué debería responder a eso?",
            "necesita_aprendizaje": True,
            "pregunta_original": query
        }

    respuesta = results["documents"][0][0]
    distancia = results["distances"][0][0]

    if distancia > 0.4:
        return {
            "respuesta": "Eso no lo entiendo aún 😅. ¿Qué debería responder a eso?",
            "necesita_aprendizaje": True,
            "pregunta_original": query
        }

    return {
        "respuesta": respuesta,
        "necesita_aprendizaje": False
    }

# Corregir y guardar nueva respuesta
@app.post("/corregir")
async def corregir_respuesta(
    pregunta: str = Body(..., embed=True),
    respuesta_correcta: str = Body(..., embed=True),
    metadata: dict = Body({}, embed=True)
):
    if not respuesta_correcta or len(respuesta_correcta.strip().split()) < 5:
        raise HTTPException(status_code=400, detail="La respuesta correcta debe tener al menos 5 palabras.")

    metadata_valida = {k: str(v) for k, v in metadata.items() if v is not None}
    if not metadata_valida:
        metadata_valida = {"info": "sin metadata"}

    # ✅ CORRECTO: se guarda el embedding de la PREGUNTA
    embedding = model.encode(pregunta).tolist()
    collection.add(
        documents=[respuesta_correcta],
        embeddings=[embedding],
        metadatas=[metadata_valida],
        ids=[str(uuid.uuid4())]
    )

    # También lo guardas en Mongo por si quieres ver el historial
    nueva = {
        "titulo": pregunta[:30],
        "mensajes": [
            {"rol": "Estudiante", "contenido": pregunta},
            {"rol": "IA", "contenido": respuesta_correcta}
        ]
    }
    await coleccion.insert_one(nueva)

    return {"message": "Respuesta añadida y almacenada correctamente"}

@app.patch("/conversaciones/{conv_id}")
async def actualizar_titulo(conv_id: str, nuevoTitulo: str = Body(..., embed=True)):
    res = await coleccion.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {"titulo": nuevoTitulo}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="No se pudo actualizar el título")
    return {"message": "Título actualizado"}

# Ejecución directa
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
