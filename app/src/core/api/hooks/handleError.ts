import { AxiosError } from 'axios';

interface CustomError {
  code : string[];
  detail : string;
  __general__?: string[];
}

export function handleError( axiosError : AxiosError ) : string {
  if ( axiosError.response?.data ) {
	const myError : CustomError = axiosError.response?.data as CustomError;
	if(!myError.detail){
		if(axiosError?.response?.data == "Already exists a general manager in the given entity.")
			return "Ya existe un director general en la entidad dada";
		if(axiosError?.response?.data == "The entity is already associated")
			return "La entidad ya se encuentra asociada";
		if(axiosError?.response?.data == "You cannot associate your own entity")
			return "No puedes seleccionar tu propia entidad";
		if(myError.__general__ ){
			if (myError.__general__[0] == "error")
				return "error"
		}
	}
  } else if ( axiosError.code === 'ECONNABORTED' ) {
	return 'La solicitud ha caducado. Por favor, inténtelo de nuevo más tarde.';
  } else if ( !axiosError.response ) {
	return 'Error de red. Por favor, verifique su conexión a internet.';
  } 
	const status = axiosError.response.status;
	switch (status) {
	  case 400:
		return 'Solicitud incorrecta. Por favor, verifique los parámetros de su solicitud.';
	  case 401:
		return 'No autorizado. Por favor, inicie sesión de nuevo.';
	  case 403:
		return 'Prohibido. No tiene permiso para acceder a este recurso.';
	  case 404:
		return 'Recurso no encontrado.';
	  case 500:
		return 'Error interno del servidor. Por favor, inténtelo de nuevo más tarde.';
	  default:
		return `Se ha producido un error con el código de estado: ${ status }`;
	}
}